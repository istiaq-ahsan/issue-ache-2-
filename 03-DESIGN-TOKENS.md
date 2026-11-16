# Issue Ache! --- Design Tokens

**Status:** Initial proposed UI foundation.\
**Source alignment:** The PRD specifies frontend technologies and pages
but does not prescribe a visual identity, color palette, typography, or
spacing system. Tokens below are implementation recommendations, not
requirements stated in the PRD.

## 1. Design Direction

Use a clear, modern, trustworthy campus SaaS interface: - Calm and
professional rather than playful. - Strong information hierarchy for
dashboards and tables. - Accessible contrast and visible focus states. -
Consistent status colors across institution, membership, payment, and
issue workflows. - Responsive layouts for desktop, tablet, and mobile.

## 2. Color Tokens

Suggested light theme:

  Token                     Value       Usage
  ------------------------- ----------- ----------------------------
  `--color-background`      `#F8FAFC`   App background
  `--color-surface`         `#FFFFFF`   Cards, dialogs, panels
  `--color-surface-muted`   `#F1F5F9`   Secondary surfaces
  `--color-foreground`      `#0F172A`   Primary text
  `--color-muted`           `#64748B`   Secondary text
  `--color-border`          `#E2E8F0`   Borders and dividers
  `--color-primary`         `#2563EB`   Primary actions and links
  `--color-primary-hover`   `#1D4ED8`   Primary hover
  `--color-success`         `#16A34A`   Approved, active, resolved
  `--color-warning`         `#D97706`   Pending, expiring
  `--color-danger`          `#DC2626`   Rejected, failed, urgent
  `--color-info`            `#0891B2`   Informational states

Suggested dark theme:

  Token                     Value
  ------------------------- -----------
  `--color-background`      `#0B1220`
  `--color-surface`         `#111827`
  `--color-surface-muted`   `#1F2937`
  `--color-foreground`      `#F8FAFC`
  `--color-muted`           `#94A3B8`
  `--color-border`          `#334155`
  `--color-primary`         `#60A5FA`

## 3. Semantic Status Tokens

  Meaning                          Background   Text
  -------------------------------- ------------ -----------
  Active / Approved / Successful   `#DCFCE7`    `#166534`
  Pending                          `#FEF3C7`    `#92400E`
  Locked / Inactive                `#E2E8F0`    `#334155`
  Rejected / Failed / Urgent       `#FEE2E2`    `#991B1B`
  In progress                      `#DBEAFE`    `#1E40AF`
  Resolved                         `#CCFBF1`    `#115E59`
  Closed / Archived                `#EDE9FE`    `#5B21B6`

Do not rely on color alone: pair status colors with text labels and,
where useful, icons.

## 4. Typography

Suggested font stack: - Primary: `Inter` - Fallback:
`ui-sans-serif, system-ui, sans-serif`

  Token             Suggested size     Weight
  --------------- ---------------- ----------
  `--text-xs`                 12px   400--500
  `--text-sm`                 14px   400--500
  `--text-base`               16px        400
  `--text-lg`                 18px   500--600
  `--text-xl`                 20px        600
  `--text-2xl`                24px        600
  `--text-3xl`                30px        700

Use comfortable line-height: approximately 1.5 for body copy and
1.2--1.3 for headings.

## 5. Spacing and Layout

Use a 4px base spacing scale.

  Token            Value
  -------------- -------
  `--space-1`        4px
  `--space-2`        8px
  `--space-3`       12px
  `--space-4`       16px
  `--space-5`       20px
  `--space-6`       24px
  `--space-8`       32px
  `--space-10`      40px
  `--space-12`      48px
  `--space-16`      64px

Suggested dashboard layout: - Sidebar: 240--264px on desktop. - Main
content max width: 1440px. - Page padding: 24px desktop, 16px mobile. -
Card padding: 20--24px. - Table row height: 48--56px.

## 6. Radius, Borders, and Elevation

  Token                Value
  -------------------- ------------------------------------
  `--radius-sm`        6px
  `--radius-md`        10px
  `--radius-lg`        14px
  `--radius-xl`        18px
  `--border-width`     1px
  `--shadow-card`      `0 1px 3px rgb(15 23 42 / 0.08)`
  `--shadow-popover`   `0 12px 32px rgb(15 23 42 / 0.14)`

Prefer subtle elevation. Use borders for most dashboard cards and
reserve stronger shadows for dialogs, popovers, and overlays.

## 7. Interaction Tokens

-   Minimum interactive target: 40×40px; prefer 44×44px on touch
    layouts.
-   Focus ring: 2px visible ring with offset.
-   Disabled controls: reduced contrast and no pointer interaction.
-   Loading actions: show progress and prevent duplicate submissions.
-   Destructive actions: require confirmation where data or access is
    removed.
-   Form errors: show near the field and provide a summary when multiple
    errors exist.

## 8. Component Guidance

-   Use shadcn/ui primitives consistently.
-   Use Lucide React for interface icons; avoid mixing icon styles
    unnecessarily.
-   Use Sonner for lightweight success/error feedback.
-   Use SweetAlert2 only for confirmation or important blocking dialogs.
-   Use TanStack Query for server state and Axios for HTTP requests.
-   Use Framer Motion for restrained UI transitions; use GSAP for
    deliberate, isolated motion sequences.
-   Respect `prefers-reduced-motion`.

## 9. Suggested CSS Variables

``` css
:root {
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F5F9;
  --color-foreground: #0F172A;
  --color-muted: #64748B;
  --color-border: #E2E8F0;
  --color-primary: #2563EB;
  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-danger: #DC2626;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
}
```
