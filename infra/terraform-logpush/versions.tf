terraform {
  required_version = ">= 1.14.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.3"
    }
  }

  # state に秘密は入らない (ジョブの定義と ID だけ)。infra/terraform と同じ bucket の別 prefix に置く。
  backend "gcs" {
    bucket = "blog-lacolaco-net-tfstate"
    prefix = "terraform-logpush/state"
  }
}
