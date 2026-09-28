/**
 * 같은 날 외래진료를 여러 건 저장하기 위한 F11010.ME_SEQ 와
 * (ANCD, PNUM, MEDT, ME_SEQ) 기본키를 보장합니다.
 */
const DB = '돌봄시설DB';
const TABLE = `[${DB}].[dbo].[F11010]`;

let ensurePromise = null;

async function ensureF11010MeSeq(pool) {
	if (!pool) return;
	if (!ensurePromise) {
		ensurePromise = (async () => {
			await pool.request().query(`
				IF COL_LENGTH(N'${TABLE}', N'ME_SEQ') IS NULL
				BEGIN
					ALTER TABLE ${TABLE} ADD [ME_SEQ] INT NULL;
				END
			`);
			await pool.request().query(`
				UPDATE ${TABLE}
				SET [ME_SEQ] = 1
				WHERE [ME_SEQ] IS NULL;
			`);
			await pool.request().query(`
				DECLARE @pkName sysname;
				DECLARE @pkHasSeq bit = 0;

				SELECT @pkName = kc.name
				FROM [${DB}].sys.key_constraints kc
				INNER JOIN [${DB}].sys.tables t ON kc.parent_object_id = t.object_id
				WHERE t.name = N'F11010' AND kc.[type] = 'PK';

				IF @pkName IS NOT NULL
				BEGIN
					IF EXISTS (
						SELECT 1
						FROM [${DB}].sys.index_columns ic
						INNER JOIN [${DB}].sys.columns c
							ON ic.object_id = c.object_id AND ic.column_id = c.column_id
						INNER JOIN [${DB}].sys.key_constraints kc
							ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
						INNER JOIN [${DB}].sys.tables t ON kc.parent_object_id = t.object_id
						WHERE t.name = N'F11010' AND kc.[type] = 'PK' AND c.name = N'ME_SEQ'
					)
						SET @pkHasSeq = 1;

					IF @pkHasSeq = 0
					BEGIN
						DECLARE @dropPk nvarchar(400) =
							N'ALTER TABLE ${TABLE} DROP CONSTRAINT [' + REPLACE(@pkName, ']', ']]') + N']';
						EXEC (@dropPk);
					END
				END

				IF EXISTS (
					SELECT 1
					FROM [${DB}].sys.columns c
					INNER JOIN [${DB}].sys.tables t ON c.object_id = t.object_id
					WHERE t.name = N'F11010' AND c.name = N'ME_SEQ' AND c.is_nullable = 1
				)
				BEGIN
					ALTER TABLE ${TABLE} ALTER COLUMN [ME_SEQ] INT NOT NULL;
				END

				IF NOT EXISTS (
					SELECT 1
					FROM [${DB}].sys.default_constraints dc
					INNER JOIN [${DB}].sys.columns c
						ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
					INNER JOIN [${DB}].sys.tables t ON c.object_id = t.object_id
					WHERE t.name = N'F11010' AND c.name = N'ME_SEQ'
				)
				BEGIN
					ALTER TABLE ${TABLE} ADD CONSTRAINT [DF_F11010_ME_SEQ] DEFAULT (1) FOR [ME_SEQ];
				END

				IF NOT EXISTS (
					SELECT 1
					FROM [${DB}].sys.key_constraints kc
					INNER JOIN [${DB}].sys.tables t ON kc.parent_object_id = t.object_id
					WHERE t.name = N'F11010' AND kc.[type] = 'PK'
				)
				BEGIN
					ALTER TABLE ${TABLE}
					ADD CONSTRAINT [PK_F11010] PRIMARY KEY ([ANCD], [PNUM], [MEDT], [ME_SEQ]);
				END
			`);
		})().catch((err) => {
			ensurePromise = null;
			throw err;
		});
	}
	await ensurePromise;
}

module.exports = { ensureF11010MeSeq };
