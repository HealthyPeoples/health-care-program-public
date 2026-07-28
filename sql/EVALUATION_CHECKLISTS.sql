-- 평가 체크리스트
-- 1) EVALUATION_CHECKLISTS_TABLE : 기관(ANCD)·연도별 표 형식 1건 (TASKS_JSON)
-- 2) EVALUATION_CHECKLISTS       : 직원(EMPNO)·연도별 체크 1건 (CHECKS_JSON)
-- 실행 DB: [돌봄시설DB]

-- =========================================================
-- EVALUATION_CHECKLISTS_TABLE (기관·연도당 표 1건)
-- =========================================================
IF NOT EXISTS (
  SELECT 1
  FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'EVALUATION_CHECKLISTS_TABLE'
)
BEGIN
  CREATE TABLE [돌봄시설DB].[dbo].[EVALUATION_CHECKLISTS_TABLE] (
    [ECT_SEQ]     INT IDENTITY(1,1) NOT NULL,
    [ANCD]        INT NOT NULL,
    [YEAR]        INT NOT NULL,
    [TASKS_JSON]  NVARCHAR(MAX) NOT NULL,
    [REG_ID]      NVARCHAR(50) NULL,
    [REG_DATE]    DATETIME NULL,
    [MOD_ID]      NVARCHAR(50) NULL,
    [MOD_DATE]    DATETIME NULL,
    CONSTRAINT [PK_EVALUATION_CHECKLISTS_TABLE] PRIMARY KEY CLUSTERED ([ECT_SEQ]),
    CONSTRAINT [UQ_EVALUATION_CHECKLISTS_TABLE_ANCD_YEAR] UNIQUE ([ANCD], [YEAR])
  );
END
GO

-- =========================================================
-- EVALUATION_CHECKLISTS (직원·연도당 체크 1건)
-- =========================================================
IF NOT EXISTS (
  SELECT 1
  FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'EVALUATION_CHECKLISTS'
)
BEGIN
  CREATE TABLE [돌봄시설DB].[dbo].[EVALUATION_CHECKLISTS] (
    [EC_SEQ]       INT IDENTITY(1,1) NOT NULL,
    [ANCD]         INT NOT NULL,
    [YEAR]         INT NOT NULL,
    [EMPNO]        NVARCHAR(20) NOT NULL,
    [CHECKS_JSON]  NVARCHAR(MAX) NOT NULL,
    [REG_ID]       NVARCHAR(50) NULL,
    [REG_DATE]     DATETIME NULL,
    [MOD_ID]       NVARCHAR(50) NULL,
    [MOD_DATE]     DATETIME NULL,
    CONSTRAINT [PK_EVALUATION_CHECKLISTS] PRIMARY KEY CLUSTERED ([EC_SEQ]),
    CONSTRAINT [UQ_EVALUATION_CHECKLISTS_ANCD_YEAR_EMPNO] UNIQUE ([ANCD], [YEAR], [EMPNO])
  );
END
GO
