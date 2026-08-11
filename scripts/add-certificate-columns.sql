-- Add certificate expiry date columns to personnel table
ALTER TABLE personnel 
ADD COLUMN IF NOT EXISTS passport VARCHAR(20),
ADD COLUMN IF NOT EXISTS opito VARCHAR(20),
ADD COLUMN IF NOT EXISTS medical VARCHAR(20),
ADD COLUMN IF NOT EXISTS seamanbook VARCHAR(20);

-- Add comments to describe the columns
COMMENT ON COLUMN personnel.passport IS 'Passport expiry date in dd/mm/yyyy format';
COMMENT ON COLUMN personnel.opito IS 'OPITO certificate expiry date in dd/mm/yyyy format';
COMMENT ON COLUMN personnel.medical IS 'Medical certificate expiry date in dd/mm/yyyy format';
COMMENT ON COLUMN personnel.seamanbook IS 'Seaman book expiry date in dd/mm/yyyy format';
