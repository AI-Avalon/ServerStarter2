# ServerStarter2

Start Minecraft server only ONE click !

Minecraft のマルチプレイサーバーを簡単に起動します！

詳細は[公式HP](https://server-starter-for-minecraft.github.io)をご確認ください！

<br>
<br>

<details>
  <summary>
    ServerStarter(以前のバージョン)から移行してきた方
  </summary>
  <div>
<br>
前作となるServerStarterをご利用いただいていた方々が本ソフトウェアへ移行する際の手順を下記に提示しております

試験的に掲載しておりますので，問題がなければ[公式HP](https://server-starter-for-minecraft.github.io)にも同様の内容を掲載いたします．

万一，うまく移行できないなどありましたら，恐れ入りますが Issues に投稿していただけますと幸いです．

1. [公式HP](https://server-starter-for-minecraft.github.io)にアクセスし，ServerStarter2をダウンロード＆インストールする
1. インストール後に画面を起動した際に，「既存ワールドの導入」にある「ワールドデータを選択」をクリックする
   ![ImportWorldBtn](https://github.com/CivilTT/ServerStarter2/assets/89191801/14e2a859-3a79-4587-b653-dc9299f06a23)
1. 「フォルダを選択」をクリックする
   ![SelectFolderBtn](https://github.com/CivilTT/ServerStarter2/assets/89191801/29b1dbdd-f2ee-48f0-93a3-cbde38587b6a)
1. 表示された画面の上部に以下のパスを入力し，Enter を押すことで，以前の ServerStarter のワールドデータの保存場所を開くことができる
   パス：`%AppData%\.minecraft\Servers\World_Data\`<br>
   ※インストール場所をデフォルトから変更している方は，変更した保存場所のパスをご入力ください<br>
   ![SelectFolderView](https://github.com/CivilTT/ServerStarter2/assets/89191801/943f6a24-a3ba-468d-bb73-0fdccfd24c51)
1. 以下の順にフォルダを選択していく

   1. 導入したいワールドを最後に起動した際のバージョンのフォルダを開く
   1. その中の「worlds」というフォルダを開く
   1. 導入したいワールドの名称となっているフォルダを開く
   1. その中にある「world」という名前のフォルダをクリック
   1. その状態で右下の「フォルダを選択」をクリック
      ![SelectFolderPart](https://github.com/CivilTT/ServerStarter2/assets/89191801/c389cfa6-e9e0-4322-94ac-98aecf57f8c5)

1. 画像のような確認画面が表示されるため，「ワールドを導入」をクリック
   ![ImportCheck](https://github.com/CivilTT/ServerStarter2/assets/89191801/2856d55c-23eb-40c7-9aef-373f86aa9a87)
1. しばらくするとワールドが ServerStarter2 に導入される
   ![FinalPage](https://github.com/CivilTT/ServerStarter2/assets/89191801/036bcf07-4565-4ebe-a707-29aca1839b42)

  </div>
</details>

## 開発・検証環境

このリポジトリは Node.js 20.x でのビルドを推奨します。

```sh
yarn install --frozen-lockfile
yarn test --run
yarn lint
yarn build
```

## Bedrock / 公開機能

- Bedrock Dedicated Server は Minecraft 公式の stable 版ダウンロード情報から取得します。Preview 版は自動取得対象外です。
- Bedrock サーバーは Java ランタイムを使わず、ServerStarter2 のアプリ管理キャッシュへ展開した実行ファイルを利用します。
- Java サーバーの外部公開は ngrok または playit.gg を利用できます。
- Bedrock は UDP を使うため ngrok では公開できません。Bedrock の外部公開には playit.gg agent を利用します。
- playit.gg agent は初回利用時にアプリ管理キャッシュへ自動ダウンロードされます。OS 全体への winget/apt インストールは行いません。
- agent の claim URL が表示された場合はブラウザで開き、playit.gg アカウント側で登録してください。

## ランタイムと復旧

Java ランタイム、Bedrock Server、playit.gg agent は `userData/serverstarter/cache` 配下に隔離して管理します。キャッシュ破損や実行ファイル欠損が疑われる場合は、公開設定画面の再取得ボタンや管理キャッシュ削除APIから再取得できます。

Windows/macOS の本体アップデートは既存通り GitHub Releases のインストーラーを利用します。Linux は自動インストールせず、更新通知のみ行います。アップデート取得に失敗してもアプリ起動は継続し、起動後にエラー通知を表示します。

## バックアップ

手動バックアップに加えて、ワールドごとに定期バックアップを設定できます。

- バックアップ間隔
- 最大保持数
- サーバー起動前の作成
- サーバー停止後の作成

バックアップ形式は既存の `.ssbackup` を継続し、追加の7zip依存は導入していません。
