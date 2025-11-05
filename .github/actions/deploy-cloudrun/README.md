# Deploy to Cloud Run - Composite Action

This composite action provides a reusable workflow step for building Docker images with layer caching and deploying to Google Cloud Run.

## Features

- Docker Layer Caching using GitHub Actions Cache
- Consistent deployment logic across preview and production environments
- Configurable parameters for different deployment scenarios

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `environment` | Deployment environment (preview or production) | Yes | - |
| `image-tags` | Docker image tags (multiline string) | Yes | - |
| `deploy-image` | Docker image to deploy (primary image with SHA) | Yes | - |
| `service-name` | Cloud Run service name | Yes | `web` |
| `region` | Cloud Run region | Yes | `asia-northeast1` |
| `registry` | Docker registry URL | Yes | `asia-northeast1-docker.pkg.dev` |
| `no-traffic` | Set to true for preview deployments | No | `false` |
| `revision-tag` | Cloud Run revision tag (for preview) | No | - |
| `revision-traffic` | Traffic allocation (for production) | No | - |
| `gcs-bucket` | GCS bucket name for environment variables | Yes | - |

## Outputs

| Output | Description |
|--------|-------------|
| `url` | Deployed service URL |

## Usage

### Preview Environment

```yaml
- name: Deploy to Cloud Run
  id: deploy-cloudrun
  uses: ./.github/actions/deploy-cloudrun
  with:
    environment: 'preview'
    image-tags: |
      asia-northeast1-docker.pkg.dev/blog-lacolaco-net/cloud-run-source-deploy/web:pr-${{ github.event.number }}
      asia-northeast1-docker.pkg.dev/blog-lacolaco-net/cloud-run-source-deploy/web:${{ github.sha }}
    deploy-image: 'asia-northeast1-docker.pkg.dev/blog-lacolaco-net/cloud-run-source-deploy/web:${{ github.sha }}'
    no-traffic: 'true'
    revision-tag: 'pr-${{ github.event.number }}'
    gcs-bucket: ${{ vars.GCS_BUCKET_NAME }}
```

### Production Environment

```yaml
- name: Deploy to Cloud Run
  uses: ./.github/actions/deploy-cloudrun
  with:
    environment: 'production'
    image-tags: |
      asia-northeast1-docker.pkg.dev/blog-lacolaco-net/cloud-run-source-deploy/web:latest
      asia-northeast1-docker.pkg.dev/blog-lacolaco-net/cloud-run-source-deploy/web:${{ github.sha }}
    deploy-image: 'asia-northeast1-docker.pkg.dev/blog-lacolaco-net/cloud-run-source-deploy/web:${{ github.sha }}'
    revision-traffic: 'LATEST=100'
    gcs-bucket: ${{ vars.GCS_BUCKET_NAME }}
```

## Implementation Details

### Steps

1. **Set up Docker Buildx**: Configures Docker Buildx for efficient multi-platform builds
2. **Configure Docker for Google Cloud**: Authenticates with Google Cloud Docker registry
3. **Build and push Docker image**: Builds Docker image with layer caching and pushes to registry
4. **Deploy to Cloud Run**: Deploys the pre-built image to Cloud Run

### Caching Strategy

This action uses GitHub Actions Cache for Docker layer caching:
- `cache-from: type=gha` - Read cache from GitHub Actions Cache
- `cache-to: type=gha,mode=max` - Write all layers to cache for maximum reuse

Expected performance improvement: ~53% faster deployment on subsequent builds (216s → 100s).

## Prerequisites

Before using this action, ensure:

1. Google Cloud authentication is configured (e.g., via `google-github-actions/auth`)
2. Astro build has completed and `./dist` directory exists
3. Required permissions are set for the workflow job:
   - `contents: read`
   - `packages: read`
   - `id-token: write`

## Maintenance

When updating deployment logic:
1. Modify only this composite action
2. Changes automatically apply to both preview and production workflows
3. Test in preview environment before merging to main
