-- Remove legacy placeholder; use Custom/combo on Quick Sales instead (syncs to services as category Combo).
DELETE FROM services
WHERE TRIM(name) = 'Other (Custom)' AND category = 'Other';
