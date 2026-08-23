/**
 * @file F10010 POST action 화이트리스트 (고정 SQL)
 *
 * @description
 * 클라이언트 SQL 문자열을 받지 않고 action별 고정 쿼리만 실행합니다.
 * ANCD는 세션 값으로 강제합니다.
 *
 * @module app/api/f10010/actions
 */

const { ancdEquals } = require('../../../config/sessionServer');

const T_F10010 = '[돌봄시설DB].[dbo].[F10010]';
const T_F10110 = '[돌봄시설DB].[dbo].[F10110]';
const T_F10020 = '[돌봄시설DB].[dbo].[F10020]';
const T_F11020 = '[돌봄시설DB].[dbo].[F11020]';
const T_F11040 = '[돌봄시설DB].[dbo].[F11040]';

function pick(params, key, alt) {
  if (params == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined) {
    return params[key];
  }
  if (alt && Object.prototype.hasOwnProperty.call(params, alt)) return params[alt];
  return undefined;
}

function assertSessionAncd(params, sessionAncd, keys = ['ANCD', 'ancd', 'OLD_ANCD', 'NEW_ANCD']) {
  for (const k of keys) {
    const v = pick(params, k);
    if (v == null || v === '') continue;
    if (!ancdEquals(v, sessionAncd)) {
      const err = new Error('해당 기관에 대한 접근 권한이 없습니다.');
      err.status = 403;
      throw err;
    }
  }
}

function bind(request, entries) {
  for (const [key, value] of entries) {
    request.input(key, value);
  }
  return request;
}

async function run(pool, sessionAncd, sql, inputs) {
  const request = pool.request();
  bind(request, inputs);
  const result = await request.query(sql);
  const recordset = result.recordset || [];
  return { success: true, data: recordset, count: recordset.length };
}

/** @type {Record<string, (pool: any, sessionAncd: any, params: any) => Promise<object>>} */
const ACTIONS = {
  async 'member.nextPnum'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `SELECT ISNULL(MAX(CAST(PNUM AS INT)), 0) + 1 AS NEXT_PNUM
       FROM ${T_F10010}
       WHERE ANCD = @ancd`,
      [['ancd', sessionAncd]]
    );
  },

  async 'member.insert'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `INSERT INTO ${T_F10010} (
        [ANCD], [PNUM], [P_NM], [P_BRDT], [P_NO], [P_SEX],
        [P_ZIP], [P_ADDR], [P_TEL], [P_HP], [P_GRD],
        [P_YYNO], [P_YYDT], [P_ST], [P_CINFO],
        [P_CTDT], [P_SDT], [P_SDT_TM], [P_EDT], [P_EDT_TM],
        [HCANUM], [HCAINFO], [HSPT], [DTNM], [DTTEL],
        [INDT], [ETC], [P_YYSDT], [P_YYEDT], [P_FLOOR], [ROOM_NO]
      ) VALUES (
        @ANCD, @PNUM, @P_NM, @P_BRDT, @P_NO, @P_SEX,
        @P_ZIP, @P_ADDR, @P_TEL, @P_HP, @P_GRD,
        @P_YYNO, @P_YYDT, @P_ST, @P_CINFO,
        @P_CTDT, @P_SDT, @P_SDT_TM, @P_EDT, @P_EDT_TM,
        @HCANUM, @HCAINFO, @HSPT, @DTNM, @DTTEL,
        @INDT, @ETC, @P_YYSDT, @P_YYEDT, @P_FLOOR, @ROOM_NO
      )`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['P_NM', p.P_NM ?? null],
        ['P_BRDT', p.P_BRDT ?? null],
        ['P_NO', p.P_NO ?? null],
        ['P_SEX', p.P_SEX ?? null],
        ['P_ZIP', p.P_ZIP ?? null],
        ['P_ADDR', p.P_ADDR ?? null],
        ['P_TEL', p.P_TEL ?? null],
        ['P_HP', p.P_HP ?? null],
        ['P_GRD', p.P_GRD ?? null],
        ['P_YYNO', p.P_YYNO ?? null],
        ['P_YYDT', p.P_YYDT ?? null],
        ['P_ST', p.P_ST ?? null],
        ['P_CINFO', p.P_CINFO ?? null],
        ['P_CTDT', p.P_CTDT ?? null],
        ['P_SDT', p.P_SDT ?? null],
        ['P_SDT_TM', p.P_SDT_TM ?? null],
        ['P_EDT', p.P_EDT ?? null],
        ['P_EDT_TM', p.P_EDT_TM ?? null],
        ['HCANUM', p.HCANUM ?? null],
        ['HCAINFO', p.HCAINFO ?? null],
        ['HSPT', p.HSPT ?? null],
        ['DTNM', p.DTNM ?? null],
        ['DTTEL', p.DTTEL ?? null],
        ['INDT', p.INDT ?? null],
        ['ETC', p.ETC ?? null],
        ['P_YYSDT', p.P_YYSDT ?? null],
        ['P_YYEDT', p.P_YYEDT ?? null],
        ['P_FLOOR', p.P_FLOOR ?? null],
        ['ROOM_NO', p.ROOM_NO ?? null],
      ]
    );
  },

  async 'member.update'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['OLD_ANCD', 'NEW_ANCD', 'ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `UPDATE ${T_F10010}
       SET
         [ANCD] = @NEW_ANCD,
         [P_NM] = @P_NM, [P_BRDT] = @P_BRDT, [P_NO] = @P_NO, [P_SEX] = @P_SEX,
         [P_ZIP] = @P_ZIP, [P_ADDR] = @P_ADDR, [P_TEL] = @P_TEL, [P_HP] = @P_HP,
         [P_GRD] = @P_GRD, [P_YYNO] = @P_YYNO, [P_YYDT] = @P_YYDT, [P_ST] = @P_ST,
         [P_CINFO] = @P_CINFO, [P_CTDT] = @P_CTDT, [P_SDT] = @P_SDT, [P_SDT_TM] = @P_SDT_TM,
         [P_EDT] = @P_EDT, [P_EDT_TM] = @P_EDT_TM, [HCANUM] = @HCANUM, [HCAINFO] = @HCAINFO,
         [HSPT] = @HSPT, [DTNM] = @DTNM, [DTTEL] = @DTTEL, [ETC] = @ETC,
         [P_YYSDT] = @P_YYSDT, [P_YYEDT] = @P_YYEDT, [P_FLOOR] = @P_FLOOR, [ROOM_NO] = @ROOM_NO
       WHERE [ANCD] = @OLD_ANCD AND [PNUM] = @PNUM`,
      [
        ['OLD_ANCD', sessionAncd],
        ['NEW_ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['P_NM', p.P_NM ?? null],
        ['P_BRDT', p.P_BRDT ?? null],
        ['P_NO', p.P_NO ?? null],
        ['P_SEX', p.P_SEX ?? null],
        ['P_ZIP', p.P_ZIP ?? null],
        ['P_ADDR', p.P_ADDR ?? null],
        ['P_TEL', p.P_TEL ?? null],
        ['P_HP', p.P_HP ?? null],
        ['P_GRD', p.P_GRD ?? null],
        ['P_YYNO', p.P_YYNO ?? null],
        ['P_YYDT', p.P_YYDT ?? null],
        ['P_ST', p.P_ST ?? null],
        ['P_CINFO', p.P_CINFO ?? null],
        ['P_CTDT', p.P_CTDT ?? null],
        ['P_SDT', p.P_SDT ?? null],
        ['P_SDT_TM', p.P_SDT_TM ?? null],
        ['P_EDT', p.P_EDT ?? null],
        ['P_EDT_TM', p.P_EDT_TM ?? null],
        ['HCANUM', p.HCANUM ?? null],
        ['HCAINFO', p.HCAINFO ?? null],
        ['HSPT', p.HSPT ?? null],
        ['DTNM', p.DTNM ?? null],
        ['DTTEL', p.DTTEL ?? null],
        ['ETC', p.ETC ?? null],
        ['P_YYSDT', p.P_YYSDT ?? null],
        ['P_YYEDT', p.P_YYEDT ?? null],
        ['P_FLOOR', p.P_FLOOR ?? null],
        ['ROOM_NO', p.ROOM_NO ?? null],
      ]
    );
  },

  async 'member.delete'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `DELETE FROM ${T_F10010} WHERE [ANCD] = @ANCD AND [PNUM] = @PNUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', params.PNUM],
      ]
    );
  },

  async 'member.updateContractDate'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `UPDATE ${T_F10010} SET [P_CTDT] = @P_CTDT WHERE [ANCD] = @ANCD AND [PNUM] = @PNUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', params.PNUM],
        ['P_CTDT', params.P_CTDT ?? null],
      ]
    );
  },

  async 'member.updateFromContract'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `UPDATE ${T_F10010}
       SET [P_NM]=@P_NM, [P_ST]=@P_ST, [P_CINFO]=@P_CINFO,
           [P_CTDT]=@P_CTDT, [P_SDT]=@P_SDT, [P_EDT]=@P_EDT
       WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['P_NM', p.P_NM ?? null],
        ['P_ST', p.P_ST ?? null],
        ['P_CINFO', p.P_CINFO ?? null],
        ['P_CTDT', p.P_CTDT ?? null],
        ['P_SDT', p.P_SDT ?? null],
        ['P_EDT', p.P_EDT ?? null],
      ]
    );
  },

  async 'contract.list'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `SELECT [ANCD],[PNUM],[CDT],[SVSDT],[SVEDT],[INSPER],[USRPER],[USRGU],[USRINFO],
              [EAMT],[ETAMT],[ESAMT],[USRINFO_AMT],[CHGU],[INDT],[ETC],[INEMPNO],[INEMPNM]
       FROM ${T_F10110}
       WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM
       ORDER BY [CDT] DESC`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', params.PNUM],
      ]
    );
  },

  async 'contract.insert'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `INSERT INTO ${T_F10110} (
        [ANCD],[PNUM],[CDT],[SVSDT],[SVEDT],[INSPER],[USRPER],[USRGU],[USRINFO],
        [EAMT],[ETAMT],[ESAMT],[USRINFO_AMT],[CHGU],[INDT],[ETC],[INEMPNO],[INEMPNM]
      ) VALUES (
        @ANCD,@PNUM,@CDT,@SVSDT,@SVEDT,@INSPER,@USRPER,@USRGU,@USRINFO,
        @EAMT,@ETAMT,@ESAMT,@USRINFO_AMT,@CHGU,@INDT,@ETC,@INEMPNO,@INEMPNM
      )`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['CDT', p.CDT ?? null],
        ['SVSDT', p.SVSDT ?? null],
        ['SVEDT', p.SVEDT ?? null],
        ['INSPER', p.INSPER ?? null],
        ['USRPER', p.USRPER ?? null],
        ['USRGU', p.USRGU ?? null],
        ['USRINFO', p.USRINFO ?? null],
        ['EAMT', p.EAMT ?? null],
        ['ETAMT', p.ETAMT ?? null],
        ['ESAMT', p.ESAMT ?? null],
        ['USRINFO_AMT', p.USRINFO_AMT ?? null],
        ['CHGU', p.CHGU ?? null],
        ['INDT', p.INDT ?? null],
        ['ETC', p.ETC ?? null],
        ['INEMPNO', p.INEMPNO ?? null],
        ['INEMPNM', p.INEMPNM ?? null],
      ]
    );
  },

  async 'contract.update'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `UPDATE ${T_F10110}
       SET [CDT]=@CDT,[SVSDT]=@SVSDT,[SVEDT]=@SVEDT,[INSPER]=@INSPER,[USRPER]=@USRPER,
           [USRGU]=@USRGU,[USRINFO]=@USRINFO,[EAMT]=@EAMT,[ETAMT]=@ETAMT,[ESAMT]=@ESAMT,
           [USRINFO_AMT]=@USRINFO_AMT,[CHGU]=@CHGU,[ETC]=@ETC,[INEMPNO]=@INEMPNO,[INEMPNM]=@INEMPNM
       WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM AND [CDT]=@OLD_CDT`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['OLD_CDT', p.OLD_CDT],
        ['CDT', p.CDT ?? null],
        ['SVSDT', p.SVSDT ?? null],
        ['SVEDT', p.SVEDT ?? null],
        ['INSPER', p.INSPER ?? null],
        ['USRPER', p.USRPER ?? null],
        ['USRGU', p.USRGU ?? null],
        ['USRINFO', p.USRINFO ?? null],
        ['EAMT', p.EAMT ?? null],
        ['ETAMT', p.ETAMT ?? null],
        ['ESAMT', p.ESAMT ?? null],
        ['USRINFO_AMT', p.USRINFO_AMT ?? null],
        ['CHGU', p.CHGU ?? null],
        ['ETC', p.ETC ?? null],
        ['INEMPNO', p.INEMPNO ?? null],
        ['INEMPNM', p.INEMPNM ?? null],
      ]
    );
  },

  async 'contract.delete'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `DELETE FROM ${T_F10110} WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM AND [CDT]=@CDT`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', params.PNUM],
        ['CDT', params.CDT],
      ]
    );
  },

  async 'guardian.nextBhnum'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `SELECT ISNULL(MAX(CAST(BHNUM AS INT)), 0) + 1 AS NEXT_BHNUM
       FROM ${T_F10020}
       WHERE ANCD = @ancd AND PNUM = @pnum`,
      [
        ['ancd', sessionAncd],
        ['pnum', pick(params, 'pnum', 'PNUM')],
      ]
    );
  },

  async 'guardian.insert'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `INSERT INTO ${T_F10020} (
        [ANCD],[PNUM],[BHNUM],[BHNM],[BHREL],[BHETC],[BHJB],
        [P_ZIP],[P_ADDR],[P_TEL],[P_HP],[P_EMAIL],[INDT],[ETC],[INEMPNO],[INEMPNM],[CONGU]
      ) VALUES (
        @ANCD,@PNUM,@BHNUM,@BHNM,@BHREL,@BHETC,@BHJB,
        @P_ZIP,@P_ADDR,@P_TEL,@P_HP,@P_EMAIL,@INDT,@ETC,@INEMPNO,@INEMPNM,@CONGU
      )`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['BHNUM', p.BHNUM],
        ['BHNM', p.BHNM ?? null],
        ['BHREL', p.BHREL ?? null],
        ['BHETC', p.BHETC ?? null],
        ['BHJB', p.BHJB ?? null],
        ['P_ZIP', p.P_ZIP ?? null],
        ['P_ADDR', p.P_ADDR ?? null],
        ['P_TEL', p.P_TEL ?? null],
        ['P_HP', p.P_HP ?? null],
        ['P_EMAIL', p.P_EMAIL ?? null],
        ['INDT', p.INDT ?? null],
        ['ETC', p.ETC ?? null],
        ['INEMPNO', p.INEMPNO ?? null],
        ['INEMPNM', p.INEMPNM ?? null],
        ['CONGU', p.CONGU ?? null],
      ]
    );
  },

  async 'guardian.update'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `UPDATE ${T_F10020}
       SET [BHNM]=@BHNM,[BHREL]=@BHREL,[BHETC]=@BHETC,[BHJB]=@BHJB,
           [P_ZIP]=@P_ZIP,[P_ADDR]=@P_ADDR,[P_TEL]=@P_TEL,[P_HP]=@P_HP,
           [P_EMAIL]=@P_EMAIL,[ETC]=@ETC,[CONGU]=@CONGU
       WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM AND [BHNUM]=@BHNUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['BHNUM', p.BHNUM],
        ['BHNM', p.BHNM ?? null],
        ['BHREL', p.BHREL ?? null],
        ['BHETC', p.BHETC ?? null],
        ['BHJB', p.BHJB ?? null],
        ['P_ZIP', p.P_ZIP ?? null],
        ['P_ADDR', p.P_ADDR ?? null],
        ['P_TEL', p.P_TEL ?? null],
        ['P_HP', p.P_HP ?? null],
        ['P_EMAIL', p.P_EMAIL ?? null],
        ['ETC', p.ETC ?? null],
        ['CONGU', p.CONGU ?? null],
      ]
    );
  },

  async 'guardian.delete'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `DELETE FROM ${T_F10020} WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM AND [BHNUM]=@BHNUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', params.PNUM],
        ['BHNUM', params.BHNUM],
      ]
    );
  },

  async 'counseling.nextCsnum'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `SELECT ISNULL(MAX(CAST(CSNUM AS INT)), 0) + 1 AS NEXT_CSNUM
       FROM ${T_F11020}
       WHERE ANCD = @ancd AND PNUM = @pnum`,
      [
        ['ancd', sessionAncd],
        ['pnum', pick(params, 'pnum', 'PNUM')],
      ]
    );
  },

  /**
   * F11020 PK = (ANCD, PNUM, CSDT)
   * 동일 수급자·동일 상담일자면 UPDATE, 없으면 INSERT (CSNUM 자동채번)
   */
  async 'counseling.insert'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `
      DECLARE @nextCsnum INT;
      SELECT @nextCsnum = ISNULL(MAX(CAST([CSNUM] AS INT)), 0) + 1
      FROM ${T_F11020}
      WHERE [ANCD] = @ANCD AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR);

      MERGE ${T_F11020} AS T
      USING (
        SELECT
          @ANCD AS ANCD,
          @PNUM AS PNUM,
          CAST(@CSDT AS DATE) AS CSDT
      ) AS S
        ON T.[ANCD] = S.ANCD
       AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.PNUM AS VARCHAR)
       AND T.[CSDT] = S.CSDT
      WHEN MATCHED THEN
        UPDATE SET
          [EMPNO] = @EMPNO,
          [EMPNM] = @EMPNM,
          [BHREL] = @BHREL,
          [BHRELNM] = @BHRELNM,
          [STM] = @STM,
          [ETM] = @ETM,
          [CSGU] = @CSGU,
          [CSINFO] = @CSINFO,
          [CSM] = @CSM,
          [INDT] = COALESCE(@INDT, T.[INDT]),
          [ETC] = @ETC,
          [INEMPNO] = @INEMPNO,
          [INEMPNM] = @INEMPNM
      WHEN NOT MATCHED THEN
        INSERT (
          [ANCD],[PNUM],[CSDT],[EMPNO],[EMPNM],[BHREL],[BHRELNM],[STM],[ETM],
          [CSGU],[CSINFO],[CSM],[CSNUM],[INDT],[ETC],[INEMPNO],[INEMPNM]
        ) VALUES (
          @ANCD,@PNUM,CAST(@CSDT AS DATE),@EMPNO,@EMPNM,@BHREL,@BHRELNM,@STM,@ETM,
          @CSGU,@CSINFO,@CSM,COALESCE(TRY_CAST(@CSNUM AS INT), @nextCsnum),@INDT,@ETC,@INEMPNO,@INEMPNM
        );
      `,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['CSDT', p.CSDT ?? null],
        ['EMPNO', p.EMPNO ?? null],
        ['EMPNM', p.EMPNM ?? null],
        ['BHREL', p.BHREL ?? null],
        ['BHRELNM', p.BHRELNM ?? null],
        ['STM', p.STM ?? null],
        ['ETM', p.ETM ?? null],
        ['CSGU', p.CSGU ?? null],
        ['CSINFO', p.CSINFO ?? null],
        ['CSM', p.CSM ?? null],
        ['CSNUM', p.CSNUM ?? null],
        ['INDT', p.INDT ?? null],
        ['ETC', p.ETC ?? null],
        ['INEMPNO', p.INEMPNO ?? null],
        ['INEMPNM', p.INEMPNM ?? null],
      ]
    );
  },

  async 'counseling.update'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    // 상담일자(CSDT)가 PK이므로, 일자 변경 시 대상 일자로 MERGE 후 이전 CSNUM 행 정리
    return run(
      pool,
      sessionAncd,
      `
      DECLARE @oldCsdt DATE = NULL;

      IF @CSNUM IS NOT NULL
      BEGIN
        SELECT TOP 1 @oldCsdt = [CSDT]
        FROM ${T_F11020}
        WHERE [ANCD] = @ANCD
          AND CAST([PNUM] AS VARCHAR) = CAST(@PNUM AS VARCHAR)
          AND CAST([CSNUM] AS VARCHAR) = CAST(@CSNUM AS VARCHAR);
      END

      MERGE ${T_F11020} AS T
      USING (
        SELECT @ANCD AS ANCD, @PNUM AS PNUM, CAST(@CSDT AS DATE) AS CSDT
      ) AS S
        ON T.[ANCD] = S.ANCD
       AND CAST(T.[PNUM] AS VARCHAR) = CAST(S.PNUM AS VARCHAR)
       AND T.[CSDT] = S.CSDT
      WHEN MATCHED THEN
        UPDATE SET
          [EMPNO]=@EMPNO,[EMPNM]=@EMPNM,[BHREL]=@BHREL,[BHRELNM]=@BHRELNM,
          [STM]=@STM,[ETM]=@ETM,[CSGU]=@CSGU,[CSINFO]=@CSINFO,[CSM]=@CSM
      WHEN NOT MATCHED THEN
        INSERT (
          [ANCD],[PNUM],[CSDT],[EMPNO],[EMPNM],[BHREL],[BHRELNM],[STM],[ETM],
          [CSGU],[CSINFO],[CSM],[CSNUM]
        )
        VALUES (
          @ANCD,@PNUM,CAST(@CSDT AS DATE),@EMPNO,@EMPNM,@BHREL,@BHRELNM,@STM,@ETM,
          @CSGU,@CSINFO,@CSM,
          COALESCE(
            TRY_CAST(@CSNUM AS INT),
            (SELECT ISNULL(MAX(CAST([CSNUM] AS INT)), 0) + 1
             FROM ${T_F11020}
             WHERE [ANCD]=@ANCD AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR))
          )
        );

      -- 일자를 바꾼 경우 이전 일자 행 제거
      IF @CSNUM IS NOT NULL AND @oldCsdt IS NOT NULL AND @oldCsdt <> CAST(@CSDT AS DATE)
      BEGIN
        DELETE FROM ${T_F11020}
        WHERE [ANCD]=@ANCD
          AND CAST([PNUM] AS VARCHAR)=CAST(@PNUM AS VARCHAR)
          AND CAST([CSNUM] AS VARCHAR)=CAST(@CSNUM AS VARCHAR)
          AND [CSDT]=@oldCsdt;
      END
      `,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['CSNUM', p.CSNUM ?? null],
        ['CSDT', p.CSDT ?? null],
        ['EMPNO', p.EMPNO ?? null],
        ['EMPNM', p.EMPNM ?? null],
        ['BHREL', p.BHREL ?? null],
        ['BHRELNM', p.BHRELNM ?? null],
        ['STM', p.STM ?? null],
        ['ETM', p.ETM ?? null],
        ['CSGU', p.CSGU ?? null],
        ['CSINFO', p.CSINFO ?? null],
        ['CSM', p.CSM ?? null],
      ]
    );
  },

  async 'counseling.delete'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `DELETE FROM ${T_F11020} WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM AND [CSNUM]=@CSNUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', params.PNUM],
        ['CSNUM', params.CSNUM],
      ]
    );
  },

  async 'connection.nextMenum'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `SELECT ISNULL(MAX(CAST(MENUM AS INT)), 0) + 1 AS NEXT_MENUM
       FROM ${T_F11040}
       WHERE ANCD = @ancd AND PNUM = @pnum`,
      [
        ['ancd', sessionAncd],
        ['pnum', pick(params, 'pnum', 'PNUM')],
      ]
    );
  },

  async 'connection.insert'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `INSERT INTO ${T_F11040} (
        [ANCD],[PNUM],[MEDT],[MDIC],[MINFO],[MENUM],[INDT],[ETC],[INEMPNO],[INEMPNM]
      ) VALUES (
        @ANCD,@PNUM,@MEDT,@MDIC,@MINFO,@MENUM,@INDT,@ETC,@INEMPNO,@INEMPNM
      )`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['MEDT', p.MEDT ?? null],
        ['MDIC', p.MDIC ?? null],
        ['MINFO', p.MINFO ?? null],
        ['MENUM', p.MENUM],
        ['INDT', p.INDT ?? null],
        ['ETC', p.ETC ?? null],
        ['INEMPNO', p.INEMPNO ?? null],
        ['INEMPNM', p.INEMPNM ?? null],
      ]
    );
  },

  async 'connection.update'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    const p = params || {};
    return run(
      pool,
      sessionAncd,
      `UPDATE ${T_F11040}
       SET [MEDT]=@MEDT,[MDIC]=@MDIC,[MINFO]=@MINFO,[ETC]=@ETC
       WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM AND [MENUM]=@MENUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', p.PNUM],
        ['MENUM', p.MENUM],
        ['MEDT', p.MEDT ?? null],
        ['MDIC', p.MDIC ?? null],
        ['MINFO', p.MINFO ?? null],
        ['ETC', p.ETC ?? null],
      ]
    );
  },

  async 'connection.delete'(pool, sessionAncd, params) {
    assertSessionAncd(params, sessionAncd, ['ANCD', 'ancd']);
    return run(
      pool,
      sessionAncd,
      `DELETE FROM ${T_F11040} WHERE [ANCD]=@ANCD AND [PNUM]=@PNUM AND [MENUM]=@MENUM`,
      [
        ['ANCD', sessionAncd],
        ['PNUM', params.PNUM],
        ['MENUM', params.MENUM],
      ]
    );
  },
};

async function dispatchF10010Action(pool, sessionAncd, action, params) {
  const handler = ACTIONS[action];
  if (!handler) {
    const err = new Error(`지원하지 않는 action입니다: ${action || '(없음)'}`);
    err.status = 400;
    throw err;
  }
  return handler(pool, sessionAncd, params || {});
}

module.exports = {
  ACTIONS,
  dispatchF10010Action,
};
