-- Catalogue reference data every organisation starts with (SRS MST-001, MST-003, MST-005):
-- the legacy units of measure with conversions to their base units (legacy 3kg/3KG merged),
-- the legacy product categories, and the SAP and NDDB external systems. Idempotent; existing
-- rows are left as administrators edited them.
CREATE FUNCTION catalog.seed_reference(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO catalog.uom (organization_id, code, name, name_hi, decimals_allowed, legacy_codes)
  SELECT p_org, u.code, u.name, u.name_hi, u.decimals, u.legacy
  FROM (VALUES
    ('KG',    'Kilogram',        'किलोग्राम',       3, ARRAY['KG']),
    ('GRAM',  'Gram',            'ग्राम',           0, ARRAY['GRAM']),
    ('LTR',   'Litre',           'लीटर',           3, ARRAY['LTR']),
    ('ML',    'Millilitre',      'मिलीलीटर',        0, ARRAY['ML']),
    ('NO',    'Number',          'संख्या',          0, ARRAY['NO']),
    ('NONE',  'Not specified',   'निर्दिष्ट नहीं',     3, ARRAY['NONE']),
    ('1KG',   '1 kg pack',       '1 किलो पैक',      0, ARRAY['1KG']),
    ('3KG',   '3 kg pack',       '3 किलो पैक',      0, ARRAY['3kg', '3KG']),
    ('20KG',  '20 kg pack',      '20 किलो पैक',     0, ARRAY['20KG']),
    ('25KG',  '25 kg pack',      '25 किलो पैक',     0, ARRAY['25kg']),
    ('40KG',  '40 kg pack',      '40 किलो पैक',     0, ARRAY['40KG']),
    ('45KG',  '45 kg pack',      '45 किलो पैक',     0, ARRAY['45KG']),
    ('50KG',  '50 kg pack',      '50 किलो पैक',     0, ARRAY['50kg'])
  ) AS u(code, name, name_hi, decimals, legacy)
  ON CONFLICT (organization_id, code) DO NOTHING;

  INSERT INTO catalog.uom_conversion (organization_id, from_uom_id, to_uom_id, factor)
  SELECT p_org, f.id, t.id, c.factor
  FROM (VALUES
    ('GRAM', 'KG', 0.001), ('ML', 'LTR', 0.001),
    ('1KG', 'KG', 1), ('3KG', 'KG', 3), ('20KG', 'KG', 20), ('25KG', 'KG', 25),
    ('40KG', 'KG', 40), ('45KG', 'KG', 45), ('50KG', 'KG', 50)
  ) AS c(from_code, to_code, factor)
  JOIN catalog.uom f ON f.organization_id = p_org AND f.code = c.from_code
  JOIN catalog.uom t ON t.organization_id = p_org AND t.code = c.to_code
  ON CONFLICT DO NOTHING;

  INSERT INTO catalog.product_category (organization_id, code, name)
  SELECT p_org, c.code, c.name
  FROM (VALUES
    ('CONSUMABLE', 'Consumable'), ('ASSET', 'Asset'), ('TRADING', 'Trading'),
    ('SERVICE', 'Service'), ('RAW_MATERIAL', 'Raw material'), ('FINISHED_GOOD', 'Finished good'),
    ('SPARE_PART', 'Spare part'), ('OTHER', 'Other')
  ) AS c(code, name)
  ON CONFLICT (organization_id, code) DO NOTHING;

  -- Lower priority shows first: HOD and Purchase screens read NDDB, then SAP, then the internal
  -- name, as in the legacy system.
  INSERT INTO catalog.external_system (organization_id, code, name, display_priority)
  VALUES (p_org, 'NDDB', 'NDDB', 10), (p_org, 'SAP', 'SAP', 20)
  ON CONFLICT (organization_id, code) DO NOTHING;
END
$$;
--> statement-breakpoint
SELECT catalog.seed_reference(id) FROM org.organization;
