# Deployment and infrastructure: delivery and identity

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 3 - Continuous Delivery (CD) & OIDC Authentication

### 3.1 Security Standard: Zero Long-Lived Cloud Keys

> [!CAUTION]
> Never store permanent `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub repository secrets. If secrets leak, attackers gain persistent access to your cloud infrastructure.
> Use **OpenID Connect (OIDC)** to request short-lived (1-hour) temporary STS credentials dynamically for each workflow run.

### 3.2 Production CD Workflow (GitHub Actions $\rightarrow$ AWS ECS / ECR)

```yaml
# .github/workflows/deploy.yml
name: CD Production Deployment

on:
  push:
    branches: [main]

permissions:
  id-token: write # Required for requesting the JWT from GitHub OIDC provider
  contents: read

jobs:
  deploy-production:
    name: Build, Migrate & Deploy
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      # 1. Authenticate securely via AWS OIDC (No static credentials)
      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsDeploymentRole
          aws-region: us-east-1

      # 2. Log in to Amazon ECR
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      # 3. Build & Push Multi-Arch Docker Image
      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ steps.login-ecr.outputs.registry }}/app-backend:${{ github.sha }}
            ${{ steps.login-ecr.outputs.registry }}/app-backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # 4. Run Pre-Deploy Database Migrations (Transient Task)
      - name: Run Database Migrations
        run: |
          aws ecs run-task \
            --cluster production-cluster \
            --task-definition app-migration-task \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[subnet-abc],securityGroups=[sg-123],assignPublicIp=ENABLED}"

      # 5. Trigger Zero-Downtime Rolling Update on Service
      - name: Deploy to Amazon ECS
        run: |
          aws ecs update-service \
            --cluster production-cluster \
            --service backend-service \
            --force-new-deployment
```

---
