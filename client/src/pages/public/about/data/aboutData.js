
import {
  BadgeCheck,
  Building2,
  CircleHelp,
  ClipboardList,
  Eye,
  FileCheck2,
  Handshake,
  MessageSquareText,
  Radio,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  Workflow,
} from 'lucide-react'

export const problems = [
  {
    icon: MessageSquareText,
    title: 'Reports get scattered',
    description:
      'Everyday campus concerns can be hard to route when they start in different places.',
  },
  {
    icon: Eye,
    title: 'Progress is hard to see',
    description:
      'Without a clear status, it is difficult for a reporter to know what happens next.',
  },
  {
    icon: Radio,
    title: 'People lose the thread',
    description:
      'Students, teachers, and institutional teams need a clearer way to stay connected.',
  },
  {
    icon: CircleHelp,
    title: 'Requests lack a clear path',
    description:
      'Department changes and other requests need an understandable review process.',
  },
  {
    icon: ClipboardList,
    title: 'Information lives in silos',
    description:
      'A shared institutional workspace helps keep issues, decisions, and follow-up organized.',
  },
]

export const solutions = [
  {
    icon: MessageSquareText,
    title: 'One place to report',
    description:
      'Students and teachers can submit campus issues through a structured process.',
  },
  {
    icon: UsersRound,
    title: 'Views for each role',
    description:
      'Student and teacher issue audiences stay distinct, while Authorities can manage both.',
  },
  {
    icon: Building2,
    title: 'Department-level organization',
    description:
      'Departments give institutions a practical way to organize campus operations.',
  },
  {
    icon: Workflow,
    title: 'Structured approvals',
    description:
      'Registrations and department-change requests can be reviewed by an Authority.',
  },
  {
    icon: Route,
    title: 'Visible issue progress',
    description:
      'Issues move through clear statuses, with important changes recorded in their history.',
  },
  {
    icon: FileCheck2,
    title: 'Institution-level oversight',
    description:
      'Institutional teams can manage departments, accounts, subscriptions, and payments.',
  },
]

export const benefits = [
  {
    icon: UsersRound,
    title: 'Students',
    description:
      'Report student-audience campus problems and follow their progress in one place.',
    detail: 'A clearer route from concern to update',
  },
  {
    icon: Building2,
    title: 'Teachers',
    description:
      'Report teacher-audience issues and request department changes for Authority review.',
    detail: 'The right workflow for teaching staff',
  },
  {
    icon: ShieldCheck,
    title: 'Authorities',
    description:
      'Review registrations and department requests, manage both issue audiences, and keep work organized.',
    detail: 'More context for institutional decisions',
  },
]

export const principles = [
  { icon: Eye, label: 'Transparency' },
  { icon: BadgeCheck, label: 'Accountability' },
  { icon: ClipboardList, label: 'Organization' },
  { icon: Target, label: 'Accessibility' },
  { icon: Handshake, label: 'Collaboration' },
]
