-- Views and stored functions used by the dashboards.
-- Run this after Property_Management_System.sql (tables) in pgAdmin.
-- Safe to run more than once (CREATE OR REPLACE).

-- landlord_dashboard_summary_view
CREATE OR REPLACE VIEW landlord_dashboard_summary_view AS
SELECT
    u.user_id AS landlord_id,
    u.full_name AS landlord_name,

    (SELECT COUNT(*)
     FROM properties p
     WHERE p.landlord_id = u.user_id) AS total_properties,

    (SELECT COUNT(*)
     FROM properties p
     WHERE p.landlord_id = u.user_id
     AND p.status = 'Occupied') AS occupied_properties,

    COALESCE((
        SELECT SUM(pay.amount)
        FROM properties p
        JOIN tenants t ON p.property_id = t.property_id
        JOIN payments pay ON t.tenant_id = pay.tenant_id
        WHERE p.landlord_id = u.user_id
        AND pay.status = 'Paid'
        AND DATE_TRUNC('month', pay.payment_month) =
            DATE_TRUNC('month', CURRENT_DATE)
    ), 0) AS total_rent_collected,

    (SELECT COUNT(*)
     FROM properties p
     JOIN maintenance_requests mr
       ON p.property_id = mr.property_id
     WHERE p.landlord_id = u.user_id
     AND mr.status IN ('Submitted', 'In Progress')
    ) AS pending_maintenance_requests

FROM users u
WHERE u.role = 'Landlord';

-- tenant_payment_history_view
CREATE OR REPLACE VIEW tenant_payment_history_view AS
SELECT
    t.tenant_id,
    u.full_name AS tenant_name,
    p.property_id,
    p.name AS property_name,
    pay.payment_id,
    pay.amount AS rent_amount,
    pay.payment_month,
    pay.due_date,
    pay.payment_date,
    pay.payment_method,
    pay.status AS payment_status

FROM tenants t

JOIN users u
    ON t.user_id = u.user_id

JOIN properties p
    ON t.property_id = p.property_id

JOIN payments pay
    ON t.tenant_id = pay.tenant_id;

-- Stored Function: Calculate Tenant Overdue Rent
CREATE OR REPLACE FUNCTION calculate_tenant_overdue_rent(p_tenant_id INT)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
    total_overdue NUMERIC(10,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO total_overdue
    FROM payments
    WHERE tenant_id = p_tenant_id
      AND status IN ('Pending', 'Overdue')
      AND due_date < CURRENT_DATE;

    RETURN total_overdue;
END;
$$;

-- Stored Function: Calculate Late Fee (5% of overdue rent)
CREATE OR REPLACE FUNCTION calculate_tenant_late_fee(p_tenant_id INT)
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
    total_late_fee NUMERIC(10,2);
BEGIN
    SELECT COALESCE(SUM(amount * 0.05), 0)
    INTO total_late_fee
    FROM payments
    WHERE tenant_id = p_tenant_id
      AND status IN ('Pending', 'Overdue')
      AND due_date < CURRENT_DATE;

    RETURN total_late_fee;
END;
$$;

-- Quick checks
-- SELECT * FROM landlord_dashboard_summary_view;
-- SELECT * FROM tenant_payment_history_view ORDER BY tenant_id, payment_month;
-- SELECT tenant_id, calculate_tenant_overdue_rent(tenant_id), calculate_tenant_late_fee(tenant_id) FROM tenants;
