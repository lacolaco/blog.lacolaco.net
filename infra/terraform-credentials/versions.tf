terraform {
  required_version = ">= 1.14.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.26"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.14"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }

  # state にはトークンの値が平文で入る。手元のディスクに置かず、infra/terraform と同じ bucket の別 prefix に置く。
  backend "gcs" {
    bucket = "blog-lacolaco-net-tfstate"
    prefix = "terraform-credentials/state"
  }
}
