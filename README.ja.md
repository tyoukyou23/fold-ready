# fold-ready

**折りたたみ・広い指の画面（iPhone Duo・iPad・Android の折りたたみ）で、Web アプリをネイティブのように動かす。**
React · TypeScript · 依存ゼロ · SSR 安全 · React 17+

[デモと Duo Lab](https://tyoukyou23.github.io/fold-ready/) · [English](./README.md)

```bash
npm i fold-ready
```

---

## なぜ

多くのサイトは「スマホかどうか」を**幅**で決めています。iPhone Duo を開いて横に持つと幅は **951px** —— PC の幅です —— でも**マウスはありません**。
その結果、指では絶対に出せない「hover で出るボタン」、画面の 3 分の 1 を占めるサイドバー、横に並べられるのにページを行き来する一覧 → 詳細、が届きます。

iPhone Duo の Safari が実際にページへ渡す大きさ（画面 ÷ 3 ではなく実測）:

| 姿勢 | ページの viewport | |
|---|---|---|
| 閉じた状態 | **382 × 580** | Safari の状態バーとボタンが**右側**の 1 列を使う。画面は 466 幅でも、ページはそうではない |
| 開いて縦 | **669 × 825** | Tailwind の `sm`(640) と `md`(768) の間 —— ほぼ誰も試していない幅 |
| 開いて横 | **951 × 543** | PC の幅・指の操作・とても低い |
| 閉じて横 | **678 × 340** | いちばん低い。固定ヘッダと下のバーでページの半分が埋まる |

どの姿勢も `(pointer: coarse)`・hover なし。開閉では `resize` が来るだけで再読込されない。`screen.width` は閉じた時の値のまま。Safari には Viewport Segments / Device Posture がない。
まだ誰も書いていなかった 2 つの事実:
- **半分折ると Web からは見えない。** Safari は外側の画面に移り、ページは閉じた状態（382 × 580）とまったく同じになる。テーブルトップモードも姿勢のイベントもない。
- **1 回の開閉で resize が 2〜3 回、どの姿勢でもない大きさ（466 × 498・382 × 498）を通って届く。** そのたびに組み替えると画面がちらつく。`SplitHost` は大きさが落ち着くのを待ち、`useSettledViewport()` は自分のコード用に同じことをする。

*iPhone Duo シミュレータ（Xcode 27.1）で 2026-10-21 に実測。実機での確認はこれから —— [あなたの端末の値を送る](https://tyoukyou23.github.io/fold-ready/#/measure)。*

**fold-ready の原則:** 幅ではなく**入力**で決める · window ではなく**容器**を測る · 機種を判定しない · マウスの人の使い勝手は、明示しない限り変えない。

---

## 中身

| | |
|---|---|
| `useInputMode` | `{ touch, hover, short }` —— レイアウトが本当に知りたい 3 つ |
| `SplitHost` + `Pane` | 一覧 → 詳細。余裕があれば横に並べ、なければ右から被さる。折り目が分かるブラウザでは折り目に合わせる |
| `useSelection` | 開いている項目を URL に（`?sel=42`）。ルーターを問わない |
| `KeepPlace` | **開いても読んでいた場所を失わない**。一番上の項目・フォーカス・カーソル位置を保つ |
| `ToolbarTint` | 閉じた Duo の**右の列を自分の色に**。横スクロールは起きない（実測） |
| `useVisibleViewport` | キーボード込みで「実際に見えている高さ」。JS でも CSS 変数でも |
| `FoldReadyInspector` | 開発用の小窓。今のモード・指のふり・**hover でしか出ない操作の検出**・断点の落ちどころ |
| `fold-ready/tailwind` | `can-hover:` `touch:` `short:`（v3 プラグイン。v4 は `fold-ready/tailwind.css`） |
| `fold-ready/devices` | 上の実測値をデータで |
| [Duo Lab](https://tyoukyou23.github.io/fold-ready/#/lab) | 任意の URL を 3 つの姿勢で同時に表示し、開く様子を再生 |

使い方の詳細とコード例は [英語版 README](./README.md) と [デモの API ページ](https://tyoukyou23.github.io/fold-ready/#/docs) を見てください。

### いちばん小さい例

```tsx
import { SplitHost, Pane, useSelection } from "fold-ready";

function Inbox({ mails }) {
  const [sel, setSel] = useSelection("sel");
  const open = mails.find((m) => m.id === sel);
  return (
    <SplitHost>
      <MailList mails={mails} onOpen={(m) => setSel(m.id)} />
      {open && <Pane label="メール" onClose={() => setSel(null)}>{(close) => <Message mail={open} onClose={close} />}</Pane>}
    </SplitHost>
  );
}
```

```html
<!-- マウスでは hover で出し、指では常に出す —— 幅に関係なく -->
<button class="opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100">編集</button>
```

### Tailwind v4

```css
@import "tailwindcss";
@import "fold-ready/tailwind.css";   /* can-hover: touch: short: が使えるようになる */
```

### 吸着ヘッダーがある時の KeepPlace

読んでいた位置は**ヘッダーのすぐ下**で取ります（ヘッダーに隠れている部分ではなく）。既定ではスクロール容器の `scroll-padding-top`（`document` なら `<html>` の値）を読むので、サイト全体で 1 行書けば `#アンカー` 移動もヘッダーに隠れなくなります。

```css
html { scroll-padding-top: var(--header-h); }
```

直接渡すこともできます: `<KeepPlace document topInset={61} />`（ヘッダーが縮むなら関数で）。

### Next.js App Router / Server Components

本体は `"use client"` 付きなので、Server Component のレイアウトからそのまま置けます（`<ToolbarTint>`・`<KeepPlace document />`・`<ViewportVars />`）。`fold-ready/devices` と `fold-ready/tailwind` はただのデータで client module ではないので、Server Component で `IPHONE_DUO` を読めば数値がそのまま手に入ります。

---

先生が毎日 PC・iPad・スマホで使う学校の管理システムから生まれました。MIT © tyoukyou23
