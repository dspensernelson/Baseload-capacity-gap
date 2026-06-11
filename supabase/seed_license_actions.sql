-- Seed: license_actions  ** SUPERSEDED — kept for history only **
-- license_actions is now rebuilt monthly from nrc.gov by scripts/nrc_license_actions.py
-- (workflow .github/workflows/nrc-license-monthly.yml). Do not run this file; the
-- scraper deletes and replaces renewal rows on every run.

INSERT INTO license_actions (reactor_id, action_type, action_date, new_expiration_date, nrc_docket, status, notes) VALUES

-- ============ Approved subsequent license renewals (60 -> 80 years) ============
('016d1133-4b2f-4723-a4e1-ca244e819fc8', 'subsequent_license_renewal', '2019-12-04', '2052-07-19', '50-250', 'approved', 'Turkey Point 3 — first SLR ever issued by NRC; reaffirmed 2024 after supplemental environmental review'),
('d17adc1b-45f1-4eba-8574-a79422da91d8', 'subsequent_license_renewal', '2019-12-04', '2053-04-10', '50-251', 'approved', 'Turkey Point 4 — first SLR ever issued by NRC; reaffirmed 2024 after supplemental environmental review'),
('071cf30c-5275-40ac-86df-3476e945d164', 'subsequent_license_renewal', '2020-03-05', '2053-08-08', '50-277', 'approved', 'Peach Bottom 2 SLR; reaffirmed 2024 after supplemental environmental review'),
('a1c07f10-77e7-4508-96b9-0d5597f24fdd', 'subsequent_license_renewal', '2020-03-05', '2054-07-02', '50-278', 'approved', 'Peach Bottom 3 SLR; reaffirmed 2024 after supplemental environmental review'),
('91d70aef-118c-420f-9c6e-767beaf4daa7', 'subsequent_license_renewal', '2021-05-04', '2052-05-25', '50-280', 'approved', 'Surry 1 SLR issued May 2021'),
('d1041937-5669-49c9-83a9-21d4bdb4aff4', 'subsequent_license_renewal', '2021-05-04', '2053-01-29', '50-281', 'approved', 'Surry 2 SLR issued May 2021'),
('dc585c65-aaa2-42fa-82e2-4ba9300887e2', 'subsequent_license_renewal', '2024-08-21', '2058-04-11', '50-338', 'approved', 'North Anna 1 SLR issued Aug 2024 — verify exact issue date'),
('75ce5eef-c328-4228-83d5-efd7bf570101', 'subsequent_license_renewal', '2024-08-21', '2060-08-21', '50-339', 'approved', 'North Anna 2 SLR issued Aug 2024 — verify exact issue date'),

-- ============ SLR applications under NRC review ============
('bbfbd5d7-c041-42bc-92b0-2ee5263a00c0', 'subsequent_license_renewal', '2021-06-07', NULL, '50-269', 'under_review', 'Oconee 1 SLR application — verify current review status'),
('78eccbc7-635f-4e76-9888-e1e0ca3b63b5', 'subsequent_license_renewal', '2021-06-07', NULL, '50-270', 'under_review', 'Oconee 2 SLR application — verify current review status'),
('36eb503a-c0ac-4779-b2ec-58ad000fed4a', 'subsequent_license_renewal', '2021-06-07', NULL, '50-287', 'under_review', 'Oconee 3 SLR application — verify current review status'),
('8a519d44-27fd-4a97-b41e-4b6718de9cdd', 'subsequent_license_renewal', '2020-11-16', NULL, '50-266', 'under_review', 'Point Beach 1 SLR application — verify current review status'),
('1c89dc86-dbaa-4982-8db7-4c6a1f7dc196', 'subsequent_license_renewal', '2020-11-16', NULL, '50-301', 'under_review', 'Point Beach 2 SLR application — verify current review status'),
('e3c5d9ed-9df0-4f5f-a3c5-ac60d08bf684', 'subsequent_license_renewal', '2021-08-03', NULL, '50-335', 'under_review', 'St. Lucie 1 SLR application — verify current review status'),
('2b6919e3-5df4-4dff-8dd3-c2603df6fc29', 'subsequent_license_renewal', '2021-08-03', NULL, '50-389', 'under_review', 'St. Lucie 2 SLR application — verify current review status'),
('7c5f22b1-05d6-44e0-843d-e6f91bd0ecae', 'subsequent_license_renewal', '2022-10-03', NULL, '50-445', 'under_review', 'Comanche Peak 1 SLR application — verify current review status'),
('331bd161-267e-4505-8434-f3b62aa7ecc2', 'subsequent_license_renewal', '2022-10-03', NULL, '50-446', 'under_review', 'Comanche Peak 2 SLR application — verify current review status'),
('fa6cb329-8e5b-4f9b-84b6-366a3c1e4390', 'subsequent_license_renewal', '2024-01-29', NULL, '50-259', 'under_review', 'Browns Ferry 1 SLR application — verify current review status'),
('eba13624-fc70-4247-a8b6-bcea4159d41a', 'subsequent_license_renewal', '2024-01-29', NULL, '50-260', 'under_review', 'Browns Ferry 2 SLR application — verify current review status'),
('e336fcee-79ec-4b55-aa19-1bd9f478975f', 'subsequent_license_renewal', '2024-01-29', NULL, '50-296', 'under_review', 'Browns Ferry 3 SLR application — verify current review status'),
('83e683f7-51d7-4e10-8989-f9c2191aa912', 'subsequent_license_renewal', NULL, NULL, '50-325', 'under_review', 'Brunswick 1 SLR application filed 2024 — verify date and status'),
('743f1e38-5ddc-4a26-ae97-a03302e9d9b6', 'subsequent_license_renewal', NULL, NULL, '50-324', 'under_review', 'Brunswick 2 SLR application filed 2024 — verify date and status'),
('a09fd44e-56b3-4454-a902-6946acc145c1', 'subsequent_license_renewal', NULL, NULL, '50-237', 'under_review', 'Dresden 2 SLR application (Constellation, ~2025) — verify date and status'),
('c213872a-82ea-40d4-88f3-8e3694d17ce6', 'subsequent_license_renewal', NULL, NULL, '50-249', 'under_review', 'Dresden 3 SLR application (Constellation, ~2025) — verify date and status'),

-- ============ Initial license renewals under review ============
('b7ae3f5f-e3d1-4db9-acd7-e40d13b49626', 'license_renewal', NULL, NULL, '50-461', 'under_review', 'Clinton initial license renewal application (~2024); would extend to ~2046 — verify'),
('5b4c3c02-0d1a-403b-a12a-5eb111d2c8cd', 'license_renewal', '2023-11-07', NULL, '50-275', 'under_review', 'Diablo Canyon 1 LR application resubmitted Nov 2023; operating under timely renewal doctrine'),
('74ca30d4-7527-4079-8dda-54ee8e11198a', 'license_renewal', '2023-11-07', NULL, '50-323', 'under_review', 'Diablo Canyon 2 LR application resubmitted Nov 2023; operating under timely renewal doctrine'),

-- ============ Restart authorization ============
(NULL, 'restart_authorization', NULL, NULL, '50-255', 'approved', 'Palisades (Holtec) — first-ever US restart of a shutdown plant; NRC authorized restart and unit returned to service 2025. Not in reactors table (tracked in decommissioning) — verify details');
