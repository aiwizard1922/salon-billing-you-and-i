-- Store split tender in invoices.notes (PAY_SPLIT_JSON:{...}); drop amount-only columns.
-- Safe if 018 was never applied (columns missing).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'primary_payment_amount'
  ) THEN
    UPDATE invoices
    SET notes = trim(both E'\n' from concat_ws(E'\n',
      nullif(trim(both from coalesce(notes, '')), ''),
      'PAY_SPLIT_JSON:' || (
        jsonb_strip_null(
          jsonb_build_object(lower(trim(payment_method::text)), to_jsonb(primary_payment_amount))
          || jsonb_build_object(lower(trim(secondary_payment_method::text)), to_jsonb(secondary_payment_amount))
        )
      )::text
    ))
    WHERE primary_payment_amount IS NOT NULL
      AND secondary_payment_amount IS NOT NULL
      AND secondary_payment_method IS NOT NULL
      AND coalesce(lower(payment_method::text), '') NOT LIKE 'membership%';

    ALTER TABLE invoices DROP COLUMN primary_payment_amount;
    ALTER TABLE invoices DROP COLUMN secondary_payment_amount;
  END IF;
END $$;
