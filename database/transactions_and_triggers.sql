-- We implement and test the transactions and triggers here. We remove the updated rows so that it becomes clean for implementation in Next.js

-- Assigning a Tenant (Transaction)
BEGIN;
-- 1. Insert the tenant (Assuming user_id 5 is Evan, and property_id 2 is Ocean View Villa)
INSERT INTO tenants (user_id, property_id, lease_start_date, lease_end_date, status)
VALUES (5, 2, '2026-03-01', '2027-02-28', 'Active');

-- 2. Update the property status to Occupied
UPDATE properties 
SET status = 'Occupied' 
WHERE property_id = 2;

-- 3. Insert the lease document metadata
INSERT INTO lease_documents (tenant_id, property_id, file_name, file_path)
VALUES (currval('tenants_tenant_id_seq'), 2, 'evan_lease.pdf', '/uploads/leases/evan_lease.pdf');

-- Save all changes permanently
COMMIT;

-- Step 4: Undo it so that you can test it in Next.js
DELETE FROM lease_documents WHERE property_id = 2;
DELETE FROM tenants WHERE user_id = 5 AND property_id = 2;
UPDATE properties SET status = 'Available' WHERE property_id = 2;


-- Auto-Resolve Maintenance Request (Trigger)
-- Step 1: Create the Function
CREATE OR REPLACE FUNCTION auto_resolve_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'Resolved' AND OLD.status != 'Resolved' THEN
        NEW.resolved_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create the Trigger (Drop first to prevent errors if run twice)
DROP TRIGGER IF EXISTS trg_auto_resolve ON maintenance_requests;
CREATE TRIGGER trg_auto_resolve
BEFORE UPDATE ON maintenance_requests
FOR EACH ROW
EXECUTE FUNCTION auto_resolve_timestamp();

-- Step 3: Test it
UPDATE maintenance_requests SET status = 'Resolved' WHERE request_id = 1;

-- Step 4: Undo it
UPDATE maintenance_requests 
SET status = 'Submitted', resolved_at = NULL 
WHERE request_id = 1;


-- Auto-Overdue Payment (Trigger)
-- Step 1: Create the Function
CREATE OR REPLACE FUNCTION check_payment_overdue()
RETURNS TRIGGER AS $$
BEGIN
    -- If it's pending, and the due date has passed, make it Overdue
    IF NEW.status = 'Pending' AND NEW.due_date < CURRENT_DATE THEN
        NEW.status := 'Overdue';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create the Trigger (Drop first to prevent errors if run twice)
DROP TRIGGER IF EXISTS trg_auto_overdue ON payments;
CREATE TRIGGER trg_auto_overdue
BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION check_payment_overdue();

-- Step 3: Test it
INSERT INTO payments (tenant_id, property_id, amount, due_date, payment_month) VALUES (1, 1, 1500.00, '2025-01-01', '2025-01-01');

-- Step 4: Undo it
DELETE FROM payments WHERE due_date = '2025-01-01';