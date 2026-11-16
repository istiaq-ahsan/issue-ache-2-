
import {
  BadgeCheck,
  Building2,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  KeyRound,
  Landmark,
  Layers3,
  MessageSquareText,
  Radio,
  Route,
  ShieldCheck,
  UsersRound,
  Workflow,
} from 'lucide-react'

export const workflowSteps = [
  {
    icon: Landmark,
    title: 'Institution registration',
    shortTitle: 'Institution',
    phase: 'CREATE A CAMPUS WORKSPACE',
    description:
      'An institution registers and receives its own campus workspace.',
    details: [
      'Institution details are submitted.',
      'The institution name is checked against existing registrations.',
      'A unique Institution Code is generated for student and teacher registration.',
    ],
    tone: 'blue',
  },
  {
    icon: Layers3,
    title: 'Department setup',
    shortTitle: 'Departments',
    phase: 'ORGANIZE THE CAMPUS',
    description:
      'Institution teams create departments and activate them through demo checkout.',
    details: [
      'New departments start in LOCKED status.',
      'The institution selects a subscription plan.',
      'Successful demo payment creates a subscription and activates the department.',
    ],
    tone: 'violet',
  },
  {
    icon: KeyRound,
    title: 'Authority accounts',
    shortTitle: 'Authorities',
    phase: 'SET UP INSTITUTIONAL MANAGEMENT',
    description:
      'The institution creates Authority accounts to manage campus operations.',
    details: [
      'Authority accounts are institution-created, not publicly registered.',
      'Authorities receive initial credentials from the institution.',
      'They access their institutional dashboard to manage operations.',
    ],
    tone: 'cyan',
  },
  {
    icon: UsersRound,
    title: 'Student & teacher registration',
    shortTitle: 'Registration',
    phase: 'BRING MEMBERS ONBOARD',
    description:
      'Students and teachers register with an Institution Code and official institutional ID.',
    details: [
      'Students provide an official Student ID; teachers provide a Teacher or Employee ID.',
      'Applicants select an active department.',
      'Registrations remain PENDING until an Authority reviews them.',
    ],
    tone: 'green',
  },
  {
    icon: BadgeCheck,
    title: 'Authority approval',
    shortTitle: 'Approval',
    phase: 'REVIEW ACCESS REQUESTS',
    description:
      'Authorities review applications before members can use their dashboards.',
    details: [
      'Authorities approve or reject pending student and teacher registrations.',
      'Approved members receive access to their role-specific dashboard.',
      'Pending accounts cannot use normal role-protected features.',
    ],
    tone: 'amber',
  },
  {
    icon: MessageSquareText,
    title: 'Campus issue reporting',
    shortTitle: 'Report',
    phase: 'RAISE A CAMPUS ISSUE',
    description:
      'Students and teachers report issues to their respective audiences.',
    details: [
      'Students report student-audience issues; teachers report teacher-audience issues.',
      'Reports include a category and priority.',
      'Members can track issues permitted for their role.',
    ],
    tone: 'blue',
  },
  {
    icon: ClipboardCheck,
    title: 'Authority issue management',
    shortTitle: 'Authority action',
    phase: 'REVIEW AND TAKE ACTION',
    description:
      'Authorities review reports, update status, and preserve the record of progress.',
    details: [
      'Authorities manage issues for both audiences within their institution.',
      'They can add notes and resolution information.',
      'Status history is maintained; resolved or closed issues can be archived.',
    ],
    tone: 'violet',
  },
  {
    icon: Route,
    title: 'Issue lifecycle',
    shortTitle: 'Issue progress',
    phase: 'FOLLOW THE ISSUE THROUGH',
    description:
      'Issues move through the platform’s supported status sequence.',
    details: [
      'OPEN — an issue has been submitted.',
      'IN_PROGRESS — an Authority has started work.',
      'RESOLVED — the reported issue has been resolved.',
      'CLOSED — the issue has been formally closed.',
    ],
    statuses: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    tone: 'amber',
  },
]

export const roleDetails = {
  student: {
    label: 'Student',
    icon: UsersRound,
    intro:
      'A clear way to raise student campus concerns and see what happens next.',
    steps: [
      'Register with your Institution Code.',
      'Submit your official Student ID and select an active department.',
      'Wait for an Authority to review your registration.',
      'Access your student dashboard after approval.',
      'Report student-audience campus issues.',
      'Track student issue progress and submit department-change requests.',
    ],
    cta: 'Student registration',
    href: '/student/register',
  },

  teacher: {
    label: 'Teacher',
    icon: Building2,
    intro:
      'A dedicated workflow for teacher issues and department memberships.',
    steps: [
      'Register with your Institution Code.',
      'Submit your official Teacher or Employee ID and select a department.',
      'Wait for an Authority to review your registration.',
      'Access your teacher dashboard after approval.',
      'Report teacher-audience campus issues and track their progress.',
      'Request permitted department membership changes for Authority review.',
    ],
    cta: 'Teacher registration',
    href: '/teacher/register',
  },

  authority: {
    label: 'Authority',
    icon: ShieldCheck,
    intro:
      'Manage institutional registrations, requests, issues, and oversight in one place.',
    steps: [
      'Receive institution-created account credentials.',
      'Sign in to your Authority dashboard.',
      'Review and approve or reject student and teacher registrations.',
      'Review department-change requests.',
      'Manage student and teacher issues, notes, and status changes.',
      'View relevant institutional analytics and audit logs.',
    ],
    cta: 'Authority sign in',
    href: '/authority/login',
  },
}

export const issueStages = [
  {
    status: 'OPEN',
    title: 'Submitted',
    description: 'An issue has been submitted.',
    icon: MessageSquareText,
    tone: 'open',
  },
  {
    status: 'IN_PROGRESS',
    title: 'Work begins',
    description: 'An Authority has started working on it.',
    icon: Workflow,
    tone: 'progress',
  },
  {
    status: 'RESOLVED',
    title: 'Resolved',
    description: 'The reported issue has been resolved.',
    icon: Check,
    tone: 'resolved',
  },
  {
    status: 'CLOSED',
    title: 'Formally closed',
    description: 'The issue has been formally closed.',
    icon: FileCheck2,
    tone: 'closed',
  },
]

export const accessLevels = [
  {
    role: 'Student',
    audience: 'Student issues',
    icon: UsersRound,
    tone: 'student',
    description:
      'Students see student-audience issues relevant to their access.',
  },
  {
    role: 'Teacher',
    audience: 'Teacher issues',
    icon: Building2,
    tone: 'teacher',
    description:
      'Teachers see teacher-audience issues relevant to their access.',
  },
  {
    role: 'Authority',
    audience: 'Both audiences',
    icon: ShieldCheck,
    tone: 'authority',
    description:
      'Authorities can manage both student and teacher issues within their institution.',
  },
]

export const benefits = [
  {
    icon: Radio,
    title: 'Organized communication',
    description:
      'Bring campus concerns into a clear, dedicated process.',
  },
  {
    icon: BadgeCheck,
    title: 'Structured approvals',
    description:
      'Keep registrations and department changes under Authority review.',
  },
  {
    icon: Layers3,
    title: 'Department-level management',
    description:
      'Organize campus operations around institution-owned departments.',
  },
  {
    icon: Route,
    title: 'Transparent issue tracking',
    description:
      'Follow an issue through clearly defined statuses and recorded history.',
  },
  {
    icon: ClipboardCheck,
    title: 'Institutional accountability',
    description:
      'Preserve important decisions and actions with audit records.',
  },
  {
    icon: ClipboardList,
    title: 'Centralized information',
    description:
      'Keep relevant registrations, requests, and issues in one workspace.',
  },
]
