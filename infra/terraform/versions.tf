terraform {
  required_version = ">= 1.14.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
  }

  backend "gcs" {
    bucket = "blog-lacolaco-net-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = "blog-lacolaco-net"
  region  = "asia-northeast1"
}
