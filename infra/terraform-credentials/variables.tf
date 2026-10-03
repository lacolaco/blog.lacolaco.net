variable "token_expires_on" {
  description = "Cloudflare デプロイ用トークンの有効期限 (RFC 3339)。ローテーション時に更新する。"
  type        = string
  default     = "2027-10-04T00:00:00Z"
}
