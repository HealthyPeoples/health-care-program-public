-- F51012 욕구사정기록지 최신판 컬럼 추가
-- 앱 기동 시 /api/f51012 GET·POST에서도 동일하게 자동 추가됩니다.

-- 질병1 눈·귀질환
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'D08_04') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [D08_04] CHAR(1) NULL; -- 만성중이염
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'D08_05') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [D08_05] CHAR(1) NULL; -- 이명

-- 질병2 기타질환
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'D11_01') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [D11_01] CHAR(1) NULL; -- 암
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'D11_02') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [D11_02] CHAR(1) NULL; -- 알레르기
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'D11_03') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [D11_03] CHAR(1) NULL; -- 기타
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'D11_NOTE') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [D11_NOTE] NVARCHAR(MAX) NULL; -- 기타질환 상세

-- 신체 활동평가·배뇨/배변
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C13') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C13] CHAR(1) NULL; -- 음식삼키기 A~D
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C14') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C14] CHAR(1) NULL; -- 전화사용
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C15') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C15] CHAR(1) NULL; -- 물건사기
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C16') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C16] CHAR(1) NULL; -- 식사준비
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C17') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C17] CHAR(1) NULL; -- 집안일
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C18') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C18] CHAR(1) NULL; -- 교통수단이용
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C19') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C19] CHAR(1) NULL; -- 금전관리
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C20') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C20] CHAR(1) NULL; -- 배뇨기능
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C21') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C21] CHAR(1) NULL; -- 배변기능
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C22') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C22] CHAR(1) NULL; -- 배뇨방법
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'C23') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [C23] CHAR(1) NULL; -- 배변방법

-- 구강과 영양
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'I06') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [I06] CHAR(1) NULL; -- 구강건강
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'I06_01') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [I06_01] NVARCHAR(200) NULL;
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'I07') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [I07] CHAR(1) NULL; -- 치료식
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'I07_01') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [I07_01] NVARCHAR(200) NULL;
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'I08') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [I08] CHAR(1) NULL; -- 영양상태
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'I08_01') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [I08_01] NVARCHAR(200) NULL;

-- 재활 운동장애~신체기능
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'E13') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [E13] CHAR(1) NULL; -- 관절구축 유무
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'E13_01') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [E13_01] NVARCHAR(200) NULL; -- 관절구축 부위
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'E14') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [E14] CHAR(1) NULL; -- 마비
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'E15') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [E15] CHAR(1) NULL; -- 근위축 유무
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'E15_01') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [E15_01] NVARCHAR(200) NULL; -- 근위축 부위
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'E16') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [E16] CHAR(1) NULL; -- 보행
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'E17') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [E17] CHAR(1) NULL; -- 신체기능

-- 간호관리 추가항목
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F12') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F12] CHAR(1) NULL; -- 위루간호
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F13') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F13] CHAR(1) NULL; -- 정맥영양
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F14') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F14] CHAR(1) NULL; -- 유치도뇨
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F15') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F15] CHAR(1) NULL; -- 단순도뇨
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F16') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F16] CHAR(1) NULL; -- 방광루
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F17') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F17] CHAR(1) NULL; -- 혈압측정
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F18') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F18] CHAR(1) NULL; -- 혈당측정
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F19') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F19] CHAR(1) NULL; -- 주사
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F20') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F20] CHAR(1) NULL; -- 투약관리
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F21') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F21] CHAR(1) NULL; -- 암관리
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'F22') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [F22] CHAR(1) NULL; -- 호스피스

-- 의사소통 시력
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'H04') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [H04] CHAR(1) NULL;

-- 가족환경
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'J04') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [J04] CHAR(1) NULL; -- 주거형태
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'J04_01') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [J04_01] NVARCHAR(200) NULL;
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'J05') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [J05] CHAR(1) NULL; -- 사회적교류

-- 자원이용
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'K03_05') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [K03_05] CHAR(1) NULL; -- 노인맞춤돌봄서비스
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'K03_06') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [K03_06] CHAR(1) NULL; -- 노인복지관
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'K03_07') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [K03_07] CHAR(1) NULL; -- 보건의료서비스
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'K03_08') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [K03_08] CHAR(1) NULL; -- 이동지원서비스
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'K03_09') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [K03_09] CHAR(1) NULL; -- 장애인활동지원서비스

-- 개별욕구
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L01_04') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L01_04] CHAR(1) NULL; -- 신체활동지원
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L01_05') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L01_05] CHAR(1) NULL; -- 인지활동지원
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L01_06') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L01_06] CHAR(1) NULL; -- 정서지원
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L01_07') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L01_07] CHAR(1) NULL; -- 기능회복훈련
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L01_08') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L01_08] CHAR(1) NULL; -- 구강관리
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L01_09') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L01_09] CHAR(1) NULL; -- 영양관리
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L01_10') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L01_10] CHAR(1) NULL; -- 가족상담
IF COL_LENGTH(N'[돌봄시설DB].[dbo].[F51012]', N'L03') IS NULL ALTER TABLE [돌봄시설DB].[dbo].[F51012] ADD [L03] NVARCHAR(MAX) NULL; -- 보호자 희망
