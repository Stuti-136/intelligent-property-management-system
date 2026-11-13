-- 1. INSERT USERS (2 Landlords, 3 Tenants)
INSERT INTO users (full_name, email, phone, password_hash, role) VALUES
('Alice Smith', 'alice.landlord@email.com', '555-0101', 'hashed_pass_1', 'Landlord'),
('Bob Jones', 'bob.landlord@email.com', '555-0102', 'hashed_pass_2', 'Landlord'),
('Charlie Brown', 'charlie.tenant@email.com', '555-0201', 'hashed_pass_3', 'Tenant'),
('Diana Prince', 'diana.tenant@email.com', '555-0202', 'hashed_pass_4', 'Tenant'),
('Evan Wright', 'evan.tenant@email.com', '555-0203', 'hashed_pass_5', 'Tenant');

-- 2. INSERT PROPERTIES (Landlord 1 owns 2 properties, Landlord 2 owns 1)
-- Note: property_id is auto-generated (1, 2, 3)
INSERT INTO properties (landlord_id, name, address, city, rent_amt, status, description) VALUES
(1, 'Sunset Apartments', '123 Main St', 'Metropolis', 1500.00, 'Occupied', '2BHK with balcony'),
(1, 'Ocean View Villa', '456 Beach Rd', 'Coastal City', 3000.00, 'Available', 'Luxury villa with pool'),
(2, 'Downtown Loft', '789 Center Blvd', 'Gotham', 2000.00, 'Occupied', '1BHK modern loft');

-- 3. INSERT TENANTS (Assigning Tenant 3 to Property 1, and Tenant 4 to Property 3)
-- Note: user_id 3 is Charlie (Tenant), user_id 4 is Diana (Tenant)
INSERT INTO tenants (user_id, property_id, lease_start_date, lease_end_date, status) VALUES
(3, 1, '2026-01-01', '2026-12-31', 'Active'),  -- Charlie rents Sunset Apartments
(4, 3, '2026-02-01', '2027-01-31', 'Active');  -- Diana rents Downtown Loft

-- 4. INSERT LEASE DOCUMENTS (For the tenants above)
INSERT INTO lease_documents (tenant_id, property_id, file_name, file_path) VALUES
(1, 1, 'charlie_lease_2026.pdf', '/uploads/leases/charlie_lease_2026.pdf'),
(2, 3, 'diana_lease_2026.pdf', '/uploads/leases/diana_lease_2026.pdf');

-- 5. INSERT PAYMENTS 
-- Charlie (Tenant 1) paid Jan rent. Diana (Tenant 2) has a pending payment.
INSERT INTO payments (tenant_id, property_id, amount, due_date, payment_date, payment_month, payment_method, status) VALUES
(1, 1, 1500.00, '2026-01-05', '2026-01-04', '2026-01-01', 'Bank Transfer', 'Paid'),
(1, 1, 1500.00, '2026-02-05', NULL, '2026-02-01', NULL, 'Pending'),
(2, 3, 2000.00, '2026-02-05', NULL, '2026-02-01', NULL, 'Pending');

-- 6. INSERT MAINTENANCE REQUESTS
-- Charlie (Tenant 1) reported a leaking tap. 
INSERT INTO maintenance_requests (tenant_id, property_id, title, description, status, priority) VALUES
(1, 1, 'Leaking Kitchen Tap', 'The kitchen tap is dripping constantly, wasting water.', 'Submitted', 'High'),
(2, 3, 'AC Not Cooling', 'The AC in the living room is blowing warm air.', 'In Progress', 'Medium');

SELECT * FROM users;
SELECT * FROM properties;
SELECT * FROM tenants;
SELECT * FROM payments;
SELECT * FROM maintenance_requests;
SELECT * FROM lease_documents;
