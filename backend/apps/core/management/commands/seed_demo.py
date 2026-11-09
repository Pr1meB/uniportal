"""Load a realistic demo university so every workflow can be tried immediately.

    python manage.py seed_demo            # fails if data already exists
    python manage.py seed_demo --if-empty # no-op when users exist (used by entrypoint)

The previous session's results are produced through the real service layer
(save -> submit -> approve), so the audit trail and GPA history are genuine.
"""
import random
from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.academics.models import (
    DEFAULT_GRADE_BANDS,
    AcademicSession,
    Course,
    CourseOffering,
    Department,
    Faculty,
    GradeBand,
    Program,
    Semester,
    Term,
)
from apps.accounts.models import LecturerProfile, Role, StudentProfile, User
from apps.registration.models import CourseRegistration
from apps.results import services as results

PASSWORD = "Uemp@2026"

FIRST_NAMES = [
    "Chinedu", "Aisha", "Tunde", "Ngozi", "Emeka", "Fatima", "Seun", "Amaka", "Ibrahim", "Chiamaka", "Yusuf",
    "Temitope", "Obinna", "Halima", "Kelechi", "Funmilayo", "Musa", "Adaeze", "Segun", "Zainab", "Uche", "Bisola",
    "Abdullahi", "Ifeoma", "Olumide", "Hadiza", "Chukwuma", "Yetunde", "Sani", "Nneka", "Damilola", "Aminu",
    "Ebuka", "Kemi", "Bashir", "Oluchi", "Femi", "Maryam", "Ikenna", "Toyin", "Garba", "Chioma", "Babatunde",
    "Rukayat", "Nnamdi", "Folake", "Usman", "Ogechi",
]
LAST_NAMES = [
    "Okafor", "Bello", "Adeyemi", "Eze", "Mohammed", "Okonkwo", "Balogun", "Nwosu", "Abubakar", "Ogunleye",
    "Chukwu", "Danjuma", "Afolabi", "Obi", "Lawal", "Nwachukwu", "Adebayo", "Ibekwe", "Suleiman", "Oyelaran",
    "Umeh", "Garba", "Ajayi", "Onyeka", "Yakubu", "Oladipo", "Anozie", "Aliyu", "Ojo", "Ekwueme",
]

STRUCTURE = {
    ("Faculty of Science", "SCI"): [
        ("Computer Science", "CSC", "B.Sc.", 4),
        ("Mathematics", "MTH", "B.Sc.", 4),
    ],
    ("Faculty of Engineering", "ENG"): [
        ("Electrical/Electronic Engineering", "EEE", "B.Eng.", 5),
        ("Mechanical Engineering", "MEE", "B.Eng.", 5),
    ],
}

# (level, term) -> [(title, units)] ; codes are generated (odd = first semester)
COURSES = {
    "CSC": {
        (100, "FIRST"): [("Introduction to Computer Science", 3), ("Introduction to Problem Solving", 3), ("Computer Hardware Fundamentals", 2)],
        (100, "SECOND"): [("Introduction to Programming", 3), ("Digital Logic Design", 3), ("Computing and Society", 2)],
        (200, "FIRST"): [("Object-Oriented Programming", 3), ("Discrete Structures", 3), ("Computer Architecture", 2)],
        (200, "SECOND"): [("Data Structures", 3), ("Systems Analysis and Design", 3), ("Web Technologies", 2)],
        (300, "FIRST"): [("Database Management Systems", 3), ("Operating Systems", 3), ("Software Engineering", 3)],
        (300, "SECOND"): [("Algorithms and Complexity", 3), ("Computer Networks", 3), ("Human-Computer Interaction", 2)],
        (400, "FIRST"): [("Artificial Intelligence", 3), ("Compiler Construction", 3), ("Information Security", 3)],
        (400, "SECOND"): [("Project", 6), ("Distributed Systems", 3), ("Machine Learning", 3)],
    },
    "MTH": {
        (100, "FIRST"): [("Elementary Mathematics I", 3), ("Sets, Logic and Algebra", 3), ("Coordinate Geometry", 2)],
        (100, "SECOND"): [("Elementary Mathematics II", 3), ("Vectors and Mechanics", 3), ("Introductory Statistics", 2)],
        (200, "FIRST"): [("Real Analysis I", 3), ("Linear Algebra I", 3), ("Mathematical Methods I", 2)],
        (200, "SECOND"): [("Real Analysis II", 3), ("Linear Algebra II", 3), ("Numerical Analysis I", 2)],
        (300, "FIRST"): [("Abstract Algebra", 3), ("Complex Analysis", 3), ("Ordinary Differential Equations", 3)],
        (300, "SECOND"): [("Metric Spaces", 3), ("Partial Differential Equations", 3), ("Operations Research", 2)],
        (400, "FIRST"): [("Functional Analysis", 3), ("Topology", 3), ("Mathematical Modelling", 3)],
        (400, "SECOND"): [("Project", 6), ("Measure Theory", 3), ("Fluid Dynamics", 3)],
    },
    "EEE": {
        (100, "FIRST"): [("Engineering Drawing I", 2), ("Basic Electricity", 3), ("Workshop Practice I", 2)],
        (100, "SECOND"): [("Engineering Drawing II", 2), ("Applied Electricity", 3), ("Workshop Practice II", 2)],
        (200, "FIRST"): [("Circuit Theory I", 3), ("Engineering Mathematics I", 3), ("Electronic Devices", 3)],
        (200, "SECOND"): [("Circuit Theory II", 3), ("Engineering Mathematics II", 3), ("Electrical Measurements", 2)],
        (300, "FIRST"): [("Electromagnetic Fields", 3), ("Analogue Electronics", 3), ("Signals and Systems", 3)],
        (300, "SECOND"): [("Electrical Machines I", 3), ("Digital Electronics", 3), ("Control Engineering I", 3)],
        (400, "FIRST"): [("Power Systems I", 3), ("Communication Principles", 3), ("Microprocessor Systems", 3)],
        (400, "SECOND"): [("SIWES", 6), ("Power Electronics", 3), ("Instrumentation", 2)],
    },
    "MEE": {
        (100, "FIRST"): [("Engineering Drawing I", 2), ("Introduction to Engineering", 2), ("Workshop Technology I", 2)],
        (100, "SECOND"): [("Engineering Drawing II", 2), ("Engineering Materials", 3), ("Workshop Technology II", 2)],
        (200, "FIRST"): [("Engineering Mechanics (Statics)", 3), ("Thermodynamics I", 3), ("Strength of Materials I", 3)],
        (200, "SECOND"): [("Engineering Mechanics (Dynamics)", 3), ("Fluid Mechanics I", 3), ("Manufacturing Processes", 2)],
        (300, "FIRST"): [("Thermodynamics II", 3), ("Machine Design I", 3), ("Mechanics of Machines", 3)],
        (300, "SECOND"): [("Heat Transfer", 3), ("Fluid Mechanics II", 3), ("Metrology", 2)],
        (400, "FIRST"): [("Machine Design II", 3), ("Internal Combustion Engines", 3), ("Vibrations", 3)],
        (400, "SECOND"): [("SIWES", 6), ("Refrigeration and Air Conditioning", 3), ("Production Engineering", 2)],
    },
}

LECTURERS = {
    "CSC": [("Dr.", "Adaeze", "Okafor", "Senior Lecturer", "Databases & Software Engineering"),
            ("Prof.", "Ibrahim", "Danjuma", "Professor", "Artificial Intelligence"),
            ("Mr.", "Seun", "Afolabi", "Lecturer II", "Networks & Systems")],
    "MTH": [("Dr.", "Ngozi", "Eze", "Senior Lecturer", "Analysis"),
            ("Dr.", "Yusuf", "Bello", "Lecturer I", "Algebra"),
            ("Mrs.", "Folake", "Ajayi", "Lecturer II", "Applied Mathematics")],
    "EEE": [("Engr. Dr.", "Chukwuma", "Ibekwe", "Senior Lecturer", "Power Systems"),
            ("Dr.", "Hadiza", "Suleiman", "Lecturer I", "Communications"),
            ("Engr.", "Olumide", "Oyelaran", "Lecturer II", "Electronics")],
    "MEE": [("Prof.", "Babatunde", "Adebayo", "Professor", "Thermofluids"),
            ("Dr.", "Kelechi", "Umeh", "Senior Lecturer", "Machine Design"),
            ("Engr.", "Aminu", "Garba", "Lecturer II", "Manufacturing")],
}
