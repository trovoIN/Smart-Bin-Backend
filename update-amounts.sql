-- Update all payment amounts from 100 to 150
UPDATE payments 
SET amount = 150 
WHERE amount = 100 
AND status IN ('UNPAID', 'CLAIMED');
