-- Constraint smoke test for initial-schema.sql (run in a scratch DB; everything is rolled back).
-- Expected: REQ0458/REQ0459; ck_balance_nonneg, idempotency unique, append-only, ex_cycle_overlap and uq_cycle_single_active errors; late webhook keeps READ; SSR closing = 74; positive transfer rejected (ck_sse_transfer).
\set ON_ERROR_STOP 0
BEGIN;
INSERT INTO org.organization(id,name) VALUES ('00000000-0000-0000-0000-0000000000a1','Shwetdhara MPCL');
INSERT INTO config.number_series(organization_id,doc_type,prefix,padding,next_value) VALUES ('00000000-0000-0000-0000-0000000000a1','INDENT','REQ',4,458);
SELECT config.next_document_number('00000000-0000-0000-0000-0000000000a1','INDENT') AS n1, config.next_document_number('00000000-0000-0000-0000-0000000000a1','INDENT') AS n2;
INSERT INTO org.location(id,organization_id,code,name,type) VALUES ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','AKBARPUR','AKBARPUR','BMC');
INSERT INTO org.warehouse(id,organization_id,location_id,code,name) VALUES ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','AKB-STORE','Store');
INSERT INTO catalog.uom(id,organization_id,code,name) VALUES ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','BAG_50KG','Bag 50 kg');
INSERT INTO catalog.product(id,organization_id,code,name,base_uom_id) VALUES ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','P1','Cattle Feed','00000000-0000-0000-0000-0000000000d1');
INSERT INTO inventory.stock_balance(organization_id,warehouse_id,product_id,qty_on_hand) VALUES ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',10);
SAVEPOINT s1; UPDATE inventory.stock_balance SET qty_on_hand = -1; ROLLBACK TO s1;
INSERT INTO inventory.stock_transaction(organization_id,occurred_at,warehouse_id,product_id,movement_type,direction,quantity,qty_before,qty_after,source_type,source_id,performed_by,idempotency_key)
 VALUES ('00000000-0000-0000-0000-0000000000a1','2026-09-24 10:00+05:30','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1','GRN_RECEIPT',1,10,0,10,'GRN',gen_random_uuid(),gen_random_uuid(),'GRN:l1:GRN_RECEIPT');
SAVEPOINT s2; INSERT INTO inventory.stock_transaction(organization_id,occurred_at,warehouse_id,product_id,movement_type,direction,quantity,qty_before,qty_after,source_type,source_id,performed_by,idempotency_key)
 VALUES ('00000000-0000-0000-0000-0000000000a1','2026-09-24 10:00+05:30','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1','GRN_RECEIPT',1,10,0,10,'GRN',gen_random_uuid(),gen_random_uuid(),'GRN:l1:GRN_RECEIPT'); ROLLBACK TO s2;
SAVEPOINT s3; UPDATE inventory.stock_transaction SET quantity=5; ROLLBACK TO s3;
SELECT * FROM inventory.stock_period('00000000-0000-0000-0000-0000000000c1','2026-09-01','2026-10-01');
INSERT INTO recon.cycle_month(id,organization_id,year,month,name) VALUES ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1',2026,9,'September 2026');
INSERT INTO recon.payment_cycle(organization_id,cycle_month_id,cycle_no,name,start_date,end_date,status) VALUES ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f1',1,'Cycle 1','2026-09-01','2026-09-10','ACTIVE');
SAVEPOINT s4; INSERT INTO recon.payment_cycle(organization_id,cycle_month_id,cycle_no,name,start_date,end_date) VALUES ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f1',2,'Cycle 2','2026-09-10','2026-09-20'); ROLLBACK TO s4;
SAVEPOINT s5; INSERT INTO recon.payment_cycle(organization_id,cycle_month_id,cycle_no,name,start_date,end_date,status) VALUES ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000f1',2,'Cycle 2','2026-09-11','2026-09-20','ACTIVE'); ROLLBACK TO s5;
INSERT INTO notify.notification_delivery(id,organization_id,channel,recipient_masked,recipient_hash,template_code,status,dedupe_key) VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1','SMS','+91******210','\x00','ADVANCE_SALE_SAHAYAK','READ','k');
UPDATE notify.notification_delivery SET status='DELIVERED' WHERE id='00000000-0000-0000-0000-000000000011';
SELECT status AS delivery_status_after_late_webhook FROM notify.notification_delivery;
-- Sale & Stock Report closing formula (SSR-005): expect 74; positive transfer rejected
INSERT INTO reporting.stock_statement(id,organization_id,cycle_id) SELECT '00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000a1',id FROM recon.payment_cycle LIMIT 1;
INSERT INTO reporting.stock_statement_entry(statement_id,location_id,product_id,opening_balance,received,received_mcc,stock_transfer,mpp_sale,transporter_deduction,damage,expire)
 VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000e1',100,50,10,-20,60,2,3,1);
SELECT closing_balance AS ssr_closing_expect_74 FROM reporting.stock_statement_entry;
SAVEPOINT s6; UPDATE reporting.stock_statement_entry SET stock_transfer = 20; ROLLBACK TO s6;
ROLLBACK;
