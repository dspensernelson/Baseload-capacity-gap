-- Seed for the two hand-curated tables that have no scraper: the new-build/restart
-- pipeline and historical decommissioning. Run once on a fresh database (after schema.sql).
-- Provenance is stamped afterward by provenance.sql. These rows are editorial judgment,
-- revisited quarterly; the live source of truth is the database / the /data export.

INSERT INTO new_reactor_projects
  (project_name,developer,reactor_type,state,latitude,longitude,capacity_mw,target_online_year,stage,confidence,doe_ardp_funded,notes) VALUES
('Kairos Hermes Demo','Kairos Power','FHR','TN',35.93,-84.25,35,2027,'under_construction','confirmed',true,'Demonstration reactor at ETTP site, Oak Ridge TN. NRC license issued 2023.'),
('Palisades Restart','Holtec International','PWR','MI',42.322,-86.32,811,2027,'licensed','confirmed',false,'Covert MI. Original shutdown 2022. DOE loan conditional commitment 2023. Restart license in progress.'),
('Three Mile Island 1 Restart','Constellation','PWR','PA',40.15,-76.73,835,2028,'licensed','confirmed',false,'Microsoft 20-yr PPA signed 2023. NRC restart process. Crane Clean Energy Center.'),
('Natrium','TerraPower','SFR','WY',41.78,-110.54,345,2030,'under_construction','confirmed',true,'Kemmerer, WY. DOE ARDP award 2020. Construction started 2024.'),
('Xe-100 / Dow Chemical','X-energy','Xe-100','TX',28.95,-95.36,320,2030,'nrc_review','speculative',true,'Freeport TX. 4 modules x 80 MW. DOE ARDP award 2020. NRC pre-application review.'),
('BWRX-300 (TVA Clinch River)','GE-Hitachi / TVA','BWRX-300','TN',35.93,-84.07,300,2032,'early_stage','speculative',false,'Clinch River site. TVA exploring site suitability. NRC pre-application engagement.'),
('Amazon SMR (Dominion / Susquehanna)','Dominion / TBD','SMR-TBD','VA',37.54,-76.32,300,2035,'early_stage','speculative',false,'Amazon signed PPA for SMR capacity. Site and vendor TBD.');

INSERT INTO decommissioning
  (plant_name,unit_number,shutdown_date,capacity_mw_lost,reason,restart_possible,notes) VALUES
('Kewaunee','1','2013-05-07',560,'economic',false,'Dominion could not find buyer. First merchant plant closure.'),
('Vermont Yankee','1','2014-12-29',620,'economic',false,'Entergy economics and state opposition.'),
('Pilgrim','1','2019-05-31',688,'economic',false,'Entergy economics. Holtec decommissioning.'),
('Three Mile Island','1','2019-09-20',837,'economic',true,'Exelon shutdown. Constellation acquired. Microsoft PPA signed. Restart as Crane Clean Energy Center.'),
('Indian Point','2','2020-04-30',1028,'regulatory',false,'Closed under agreement with NY state. Decommissioning ongoing.'),
('Duane Arnold','1','2020-08-27',601,'economic',false,'Storm damage accelerated closure. NextEra.'),
('Indian Point','3','2021-04-30',1041,'regulatory',false,'Closed under agreement with NY state. Decommissioning ongoing.'),
('Dresden','2','2021-11-17',879,'economic',false,'Exelon closure. Illinois ZEC came too late for this unit.'),
('Dresden','3','2021-11-17',879,'economic',false,'Exelon closure. Illinois ZEC came too late for this unit.'),
('Palisades','1','2022-05-20',811,'economic',true,'Entergy shut down. Holtec acquired. Restart licensed and in progress.');
