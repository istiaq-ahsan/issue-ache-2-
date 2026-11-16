-- Department activation no longer depends on department status or billing.
-- Keep legacy payment and subscription rows; remove only the obsolete checks.
DROP TRIGGER IF EXISTS "Department_paid_activation_trigger" ON public."Department";
DROP TRIGGER IF EXISTS "Payment_paid_activation_trigger" ON public."Payment";
DROP TRIGGER IF EXISTS "Subscription_paid_activation_trigger" ON public."Subscription";

DROP FUNCTION IF EXISTS public."enforce_active_department_has_successful_payment"();
