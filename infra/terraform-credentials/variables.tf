# 入力は人が知っている名前にし、ID は main.tf で data source から引く。
# 値は秘密ではないため既定値で与える (*.tfvars は .gitignore で除外されるので使わない)。

variable "zone_name" {
  description = "Workers ルートを置く Cloudflare のゾーン名。アカウント ID とゾーン ID はここから引く。"
  type        = string
  default     = "lacolaco.net"
}

variable "github_repository" {
  description = "secret と variable を登録する GitHub のリポジトリ名 (owner なし)。owner は providers.tf で指定する。"
  type        = string
  default     = "blog.lacolaco.net"
}
