-- Add expire date columns for certificates
ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS passport_expire DATE,
ADD COLUMN IF NOT EXISTS opito_expire DATE,
ADD COLUMN IF NOT EXISTS medical_expire DATE,
ADD COLUMN IF NOT EXISTS seamanbook_expire DATE;

-- Add comment for documentation
COMMENT ON COLUMN personnel.passport_expire IS 'Passport expiration date';
COMMENT ON COLUMN personnel.opito_expire IS 'OPITO certificate expiration date';
COMMENT ON COLUMN personnel.medical_expire IS 'Medical certificate expiration date';
COMMENT ON COLUMN personnel.seamanbook_expire IS 'Seaman book expiration date';
