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


class Command(BaseCommand):
    help = "Seed the database with demo data for evaluation."

    def add_arguments(self, parser):
        parser.add_argument("--if-empty", action="store_true", help="Skip silently if users already exist.")

    def handle(self, *args, **opts):
        if User.objects.exists():
            if opts["if_empty"]:
                self.stdout.write("Data already present — skipping seed.")
                return
            raise CommandError("Database is not empty. Run `manage.py flush` first or use --if-empty.")
        self.rng = random.Random(2026)
        self.used_names = set()
        with transaction.atomic():
            self.seed()
        self.stdout.write(self.style.SUCCESS("Demo data loaded. Password for every account: %s" % PASSWORD))

    # -------------------------------------------------------------------
    def seed(self):
        for grade, lo, hi, point, remark in DEFAULT_GRADE_BANDS:
            GradeBand.objects.create(grade=grade, min_score=lo, max_score=hi, point=point, remark=remark)

        prev = AcademicSession.objects.create(name="2025/2026", start_date=date(2025, 10, 6), end_date=date(2026, 8, 28))
        cur = AcademicSession.objects.create(name="2026/2027", start_date=date(2026, 10, 5), end_date=date(2027, 8, 27))
        prev_first = Semester.objects.create(session=prev, term=Term.FIRST, start_date=date(2025, 10, 6), end_date=date(2026, 2, 27))
        prev_second = Semester.objects.create(session=prev, term=Term.SECOND, start_date=date(2026, 3, 16), end_date=date(2026, 8, 28))
        cur_first = Semester.objects.create(session=cur, term=Term.FIRST, start_date=date(2026, 10, 5), end_date=date(2027, 2, 26))
        Semester.objects.create(session=cur, term=Term.SECOND, start_date=date(2027, 3, 15), end_date=date(2027, 8, 27))
        cur_first.make_current()
        cur_first.registration_open = True
        cur_first.save()

        self.super_admin = User.objects.create_user(
            email="superadmin@uemp.test", password=PASSWORD, first_name="Grace", last_name="Adewale",
            role=Role.SUPER_ADMIN, is_staff=True, is_superuser=True,
        )

        self.depts = {}
        for (fname, fcode), depts in STRUCTURE.items():
            faculty = Faculty.objects.create(name=fname, code=fcode)
            for dname, dcode, degree, years in depts:
                dept = Department.objects.create(faculty=faculty, name=dname, code=dcode)
                program = Program.objects.create(department=dept, name=dname, code=f"{dcode}-{degree.strip('.').replace('.', '').upper()}",
                                                 degree=degree, duration_years=years)
                admin = User.objects.create_user(
                    email=f"{dcode.lower()}.admin@uemp.test", password=PASSWORD, role=Role.DEPT_ADMIN, department=dept,
                    first_name=self.rng.choice(FIRST_NAMES), last_name=self.rng.choice(LAST_NAMES),
                )
                lecturers = []
                for i, (title, first, last, rank, spec) in enumerate(LECTURERS[dcode]):
                    email = "lecturer@uemp.test" if dcode == "CSC" and i == 0 else f"{first.lower()}.{last.lower()}@uemp.test"
                    lec = User.objects.create_user(email=email, password=PASSWORD, role=Role.LECTURER, department=dept,
                                                   first_name=first, last_name=last)
                    LecturerProfile.objects.create(user=lec, staff_id=f"SP/{dcode}/{101 + i}", title=title, rank=rank,
                                                   specialization=spec, office=f"{dcode} Block, Room {10 + i}")
                    lecturers.append(lec)
                courses = self._courses(dept, program)
                self.depts[dcode] = {"dept": dept, "program": program, "admin": admin, "lecturers": lecturers,
                                     "courses": courses}

        for dcode, d in self.depts.items():
            d["students"] = self._students(dcode, d, prev, cur)

        # previous session: full approved history
        for sem in (prev_first, prev_second):
            for dcode, d in self.depts.items():
                self._run_semester(d, sem, level_offset=-100, finalize="approve")

        # current semester: offerings with allocations, registrations for most students
        for dcode, d in self.depts.items():
            self._current_semester(dcode, d, cur_first)

    # -------------------------------------------------------------------
    def _courses(self, dept, program):
        out = {}
        for (level, term), items in COURSES[dept.code].items():
            base = level + (1 if term == Term.FIRST else 2)
            for idx, (title, units) in enumerate(items):
                code = f"{dept.code} {base + idx * 2}"
                c = Course.objects.create(department=dept, code=code, title=title, units=units, level=level, term=term,
                                          description=f"{title} for {level} level {dept.name} students.")
                c.programs.add(program)
                out.setdefault((level, term), []).append(c)
        return out

    def _name(self):
        while True:
            pair = (self.rng.choice(FIRST_NAMES), self.rng.choice(LAST_NAMES))
            if pair not in self.used_names:
                self.used_names.add(pair)
                return pair

    def _students(self, dcode, d, prev, cur):
        students = []
        serial = 1
        for level in (100, 200, 300, 400):
            entry_year = 2026 - (level // 100 - 1)
            for i in range(3):
                first, last = self._name()
                demo = dcode == "CSC" and level == 300 and i == 0
                email = "student@uemp.test" if demo else f"{first.lower()}.{last.lower()}@student.uemp.test"
                u = User.objects.create_user(email=email, password=PASSWORD, role=Role.STUDENT, department=d["dept"],
                                             first_name=first, last_name=last, phone=f"080{self.rng.randint(10000000, 99999999)}")
                entry_session = prev if entry_year == 2025 else (cur if entry_year == 2026 else None)
                StudentProfile.objects.create(
                    user=u, matric_number=f"{dcode}/{entry_year}/{serial:03d}", program=d["program"], level=level,
                    entry_session=entry_session, gender=self.rng.choice(["Male", "Female"]),
                    date_of_birth=date(2008 - level // 100, self.rng.randint(1, 12), self.rng.randint(1, 28)),
                    address=f"{self.rng.randint(1, 80)} University Road, Nsukka",
                )
                u.ability = self.rng.uniform(-16, 14)  # used only while seeding
                students.append(u)
                serial += 1
        return students

    def _scores(self, student):
        ca = max(4, min(30, round(self.rng.gauss(19 + student.ability * 0.35, 4))))
        exam = max(6, min(70, round(self.rng.gauss(38 + student.ability, 11))))
        return Decimal(ca), Decimal(exam)

    def _run_semester(self, d, semester, level_offset, finalize):
        """Offer courses, register students, enter scores, submit and approve."""
        for (level, term), courses in d["courses"].items():
            if term != semester.term:
                continue
            cohort = [s for s in d["students"] if s.student_profile.level + level_offset == level]
            if not cohort:
                continue
            for idx, course in enumerate(courses):
                offering = CourseOffering.objects.create(course=course, semester=semester)
                lecturer = d["lecturers"][idx % len(d["lecturers"])]
                offering.lecturers.add(lecturer)
                for s in cohort:
                    CourseRegistration.objects.create(student=s, offering=offering, registered_by=s)
                self._grade(offering, lecturer, cohort, d["admin"], finalize)

    def _grade(self, offering, lecturer, cohort, admin, finalize, complete=True):
        regs = {r.student_id: r for r in offering.registrations.all()}
        entries = []
        for s in cohort:
            if not complete and self.rng.random() < 0.5:
                continue
            ca, exam = self._scores(s)
            entries.append({"registration": regs[s.pk].pk, "ca_score": ca, "exam_score": exam})
        if entries:
            results.save_scores(lecturer, offering, entries)
        if finalize in ("submit", "approve", "reject"):
            results.submit_sheet(lecturer, offering)
        if finalize == "approve":
            results.approve_sheet(admin, offering.result_sheet, "Reviewed and approved by departmental board.")
        if finalize == "reject":
            results.reject_sheet(admin, offering.result_sheet,
                                 "Exam scores for two students do not match the marked scripts. Please re-check and resubmit.")

    def _current_semester(self, dcode, d, semester):
        """Mixed states so every dashboard has something to show."""
        for (level, term), courses in d["courses"].items():
            if term != semester.term:
                continue
            for idx, course in enumerate(courses):
                offering = CourseOffering.objects.create(course=course, semester=semester)
                offering.lecturers.add(d["lecturers"][idx % len(d["lecturers"])])

        if dcode != "CSC":
            # other departments: everyone registered, nothing graded yet
            for s in d["students"]:
                for c in d["courses"][(s.student_profile.level, semester.term)]:
                    CourseRegistration.objects.create(student=s, offering=c.offerings.get(semester=semester), registered_by=s)
            return

        demo_student = next(s for s in d["students"] if s.email == "student@uemp.test")
        for s in d["students"]:
            if s == demo_student:
                continue  # left unregistered so the evaluator can register live
            for c in d["courses"][(s.student_profile.level, semester.term)]:
                CourseRegistration.objects.create(student=s, offering=c.offerings.get(semester=semester), registered_by=s)

        lec = d["lecturers"][0]  # lecturer@uemp.test teaches idx 0 of each level
        admin = d["admin"]
        cohorts = {lvl: [s for s in d["students"] if s.student_profile.level == lvl and s != demo_student] for lvl in (100, 200, 300, 400)}

        def off(level):
            return d["courses"][(level, semester.term)][0].offerings.get(semester=semester)

        # CSC 201 – submitted, waiting for the department admin
        self._grade(off(200), lec, cohorts[200], admin, finalize="submit")
        # CSC 401 – returned to lecturer with feedback
        self._grade(off(400), lec, cohorts[400], admin, finalize="reject")
        # CSC 101 – partially entered draft
        self._grade(off(100), lec, cohorts[100], admin, finalize="draft", complete=False)
        # CSC 301 – untouched, lecturer enters from scratch (demo student can still register)
