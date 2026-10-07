# 認証は gcloud の ADC。Logpush の所有権確認ファイルの読み取りと、バケットの参照にだけ使う。
# Cloudflare 側の操作は cf CLI (ログイン済みの OAuth) が行うため、cloudflare プロバイダーは使わない。
provider "google" {
  project = "blog-lacolaco-net"
}
