# 入力は人が知っている名前にし、ID は main.tf で引く。値は秘密ではないため既定値で与える。

variable "zone_name" {
  description = "Worker のルートを置く Cloudflare のゾーン名。アカウント ID はここから引く。"
  type        = string
  default     = "lacolaco.net"
}

variable "search_logs_bucket_name" {
  description = "Logpush の送り先の GCS バケット名。infra/terraform の search_logs.tf が作る。data source で引き、存在しなければ plan が失敗する。"
  type        = string
  default     = "blog-lacolaco-net-search-logs"
}

variable "search_worker_name" {
  description = "Logpush で送る Worker のスクリプト名 (tools/search-worker/wrangler.jsonc の name)。"
  type        = string
  default     = "blog-search"
}
