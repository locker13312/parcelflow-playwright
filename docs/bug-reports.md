# Bug reports

Defects found while adding accessibility checks with axe-core (`tests/ui/accessibility.spec.ts`). All
three are fixed in the demo app; the tests keep them from coming back.

---

## PF-1. Driver dropdown in the shipments table has no accessible name

| Field     | Value                             |
| --------- | --------------------------------- |
| Severity  | Major                             |
| Priority  | High                              |
| Component | Web UI, shipments table           |
| Status    | Fixed                             |
| WCAG      | 4.1.2 Name, Role, Value (Level A) |

**Steps to reproduce**

1. Log in as `dispatcher@parcelflow.test`.
2. Create two shipments.
3. Move focus with Tab to the driver dropdown in the first row.

**Expected:** the screen reader announces which shipment the dropdown belongs to, for example
"Driver for PF-000001, combo box, Olena Koval".

**Actual:** it announces only "combo box, Olena Koval". With several rows the dispatcher cannot tell
which parcel they are assigning a driver to.

**axe rule:** `select-name`. **Fix:** `aria-label="Driver for PF-000001"` on each row's select.

---

## PF-2. Validation errors break list semantics

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Severity  | Minor                                  |
| Priority  | Medium                                 |
| Component | Web UI, new shipment form              |
| Status    | Fixed                                  |
| WCAG      | 1.3.1 Info and Relationships (Level A) |

**Steps to reproduce**

1. Open the shipments page.
2. Submit the empty "New shipment" form.

**Expected:** errors are announced as a list of 4 items.

**Actual:** the list has `role="alert"`, which replaces its list role, so the `<li>` items are left
without a list. Screen readers read the errors as loose text without "list, 4 items".

**axe rule:** `listitem`. **Fix:** the live region moved to a wrapping `<div role="alert">`, the `<ul>`
keeps its role.

---

## PF-3. Empty state text has low contrast

| Field     | Value                               |
| --------- | ----------------------------------- |
| Severity  | Minor                               |
| Priority  | Low                                 |
| Component | Web UI, shipments page              |
| Status    | Fixed                               |
| WCAG      | 1.4.3 Contrast (Minimum) (Level AA) |

**Steps to reproduce**

1. Log in with an empty workspace.
2. Look at the "No shipments yet." text.

**Expected:** contrast ratio at least 4.5:1 for 16px text.

**Actual:** `#7b8794` on white gives 3.66:1.

**axe rule:** `color-contrast`. **Fix:** `.muted` color changed to `#52606d` (6.4:1).
