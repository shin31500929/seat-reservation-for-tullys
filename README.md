# タリーズコーヒー向け 座席利用・離席管理システム

## 1. 要件整理
- 本システムは「予約」ではなく「入店後の席利用管理」。
- 入口認証（現行QR、将来Wi-Fi/GPS差し替え可）。
- 座席状態：空席/利用中/離席中（緑/赤/黄）。
- 利用上限2時間、離席上限30分、通知（10分前/5分前/終了）。
- 利用終了時：席解放、スタンプ付与、履歴保存。
- ロール：一般利用者/店員/管理者（RBAC）。
- Socket.IOでリアルタイム更新。

## 2. 機能一覧
- 認証: JWTログイン
- 入店認証: QR/Wi-Fi/GPSストラテジ
- 座席管理: 店舗別レイアウト、座席選択、状態更新
- セッション管理: 利用開始/離席/復帰/終了/強制解放
- 通知: 利用時間・離席時間の期限通知
- スタンプ: レア度付きランダム付与、重複可、取得履歴
- 履歴: 利用履歴保存/参照
- 店員ダッシュボード: 混雑率、離席数、超過数

## 3. 非機能要件
- 保守性: Frontend/Backend分離、Prisma採用
- 拡張性: 認証方式ストラテジ設計、DB移行容易なORM層
- セキュリティ: Helmet/CORS/RateLimit/JWT/RBAC/入力検証
- 可用性: Socket.IOで即時更新
- 運用性: Docker Compose、GitHub Flow

## 4. システム構成図
```text
[Smartphone Web(React/Vite)]
   ├─ HTTPS REST -> [Express API]
   └─ WebSocket -> [Socket.IO]
                         │
                         └─ [Prisma] -> [SQLite (将来PostgreSQL)]
```

## 5. アーキテクチャ設計
- Frontend: React + TypeScript + React Router
- Backend: Express + Prisma + JWT + Socket.IO
- Domainルール: `backend/src/domain/sessionRules.ts`
- Entry認証拡張点: `backend/src/entryAuth.ts`

## 6. ディレクトリ構成
```text
.
├─ backend/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ seed.ts
│  └─ src/
│     ├─ app.ts
│     ├─ server.ts
│     ├─ auth.ts
│     ├─ entryAuth.ts
│     ├─ notifyScheduler.ts
│     ├─ socket.ts
│     └─ domain/sessionRules.ts
├─ frontend/
│  └─ src/
│     ├─ App.tsx
│     ├─ main.tsx
│     └─ index.css
└─ docker-compose.yml
```

## 7. ER図
```text
User 1---* Session *---1 Seat *---1 Store
User 1---* UsageHistory
User 1---* StampAcquisition *---1 StampDesign
User 1---* Notification
```

## 8. テーブル設計
主要テーブル:
- `User(email, passwordHash, role)`
- `Store(name, layoutJson)`
- `Seat(storeId, code, type, state, x, y)`
- `Session(userId, seatId, state, peopleCount, gender, entryMethod, notified*)`
- `UsageHistory(sessionId, forced, startedAt, endedAt)`
- `StampDesign(rarity, weight, seasonTag)`
- `StampAcquisition(userId, stampId, acquiredAt)`
- `Notification(userId, kind, message)`

## 9. API設計
- `POST /api/auth/login`
- `GET /api/stores`
- `GET /api/stores/:storeId/seats`
- `POST /api/sessions/start`
- `POST /api/sessions/:id/leave`
- `POST /api/sessions/:id/return`
- `POST /api/sessions/:id/end`
- `POST /api/staff/sessions/:id/force-end`
- `GET /api/staff/dashboard`
- `GET /api/stamps/me`
- `GET /api/history/me`
- `GET /api/notifications/me`

## 10. 権限設計
- USER: 自席利用操作、履歴/スタンプ閲覧
- STAFF: ダッシュボード、強制解放
- ADMIN: STAFF権限 + 店舗/座席/店員管理（拡張予定）

## 11. 画面一覧
- 利用者: ホーム、スタンプ、履歴
- 店員: ダッシュボード
- 管理者: 管理コンソール

## 12. 画面遷移図
```text
ホーム -> 店舗/座席確認 -> 利用開始 -> 利用中 -> 離席/復帰 -> 利用終了
ホーム -> スタンプ
ホーム -> 履歴
```

## 13. 状態遷移図
```text
Seat: VACANT -> IN_USE -> AWAY -> IN_USE -> VACANT
Session: ACTIVE <-> AWAY -> ENDED/FORCE_ENDED
```

## 14. ワイヤーフレーム
```text
[Home]
+----------------+
| 店舗名 混雑率   |
| [C-01 赤] ...  |
| [デモログイン]  |
+----------------+
```

## 15. UIデザイン案
- カフェ調（背景: ベージュ、アクセント: ブラウン）
- モバイル優先、カードUI
- 状態色: 緑/赤/黄

## 16. Docker構成
- `frontend` (Vite dev server)
- `backend` (Express + Prisma)
- SQLiteはbackend内ボリューム永続化

## 17. Gitブランチ戦略
- GitHub Flow
- `main` から `feature/*` を切ってPR
- CI通過後に `main` へマージ

## 18. コミット単位
1. scaffold(frontend/backend)
2. feat(schema/api/socket/rbac)
3. feat(ui/screens)
4. test(domain rules)
5. chore(docker/docs)

## 19. 実装ロードマップ
1. 基盤（認証/店舗/座席）
2. セッション管理（開始/離席/終了）
3. 通知と店員監視
4. スタンプと履歴
5. 管理者機能拡張

## 20. データベース初期データ
`backend/prisma/seed.ts`:
- ユーザー3種（user/staff/admin）
- サンプル店舗1件
- 座席4席（カウンター/ソファ）
- スタンプ3種（Common/Rare/Ultra Rare）

## 21. テスト方針
- 単体: 時間通知・状態遷移ルール
- API: 認証、RBAC、セッション開始/終了
- E2E（将来）: モバイル動線

## 22. 実装コード
- Backend API: `backend/src/app.ts`
- 通知スケジューラ: `backend/src/notifyScheduler.ts`
- Socket.IO: `backend/src/socket.ts`
- Frontend UI: `frontend/src/App.tsx`

## 23. デプロイ手順
1. `docker compose up --build`
2. `docker compose exec backend npm run prisma:push`
3. `docker compose exec backend npm run prisma:seed`
4. Frontend: `http://localhost:5173`
5. Backend: `http://localhost:3001`

---

## ローカル開発
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
npm run dev

# 別ターミナル
cd frontend
npm install
npm run dev
```

### デモアカウント
- user@tullys.local / password123
- staff@tullys.local / password123
- admin@tullys.local / password123
