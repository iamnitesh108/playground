// The policy files lesson "Access, policies and sharing" was recorded with (tools/s3-capture/policies), as text.
import catalogRead from '../../../../tools/s3-capture/policies/catalog-read.json?raw'
import uploadsWrite from '../../../../tools/s3-capture/policies/uploads-write.json?raw'
import catalogApp from '../../../../tools/s3-capture/policies/catalog-app.json?raw'
import invoicesRead from '../../../../tools/s3-capture/policies/invoices-read.json?raw'
import publicRead from '../../../../tools/s3-capture/policies/public-read.json?raw'
import cors from '../../../../tools/s3-capture/policies/cors.json?raw'
import awsAccessCredentials from '../../../../tools/s3-capture/aws-access/credentials?raw'
import presign from '../../../../tools/s3-capture/ts-app/presign.ts?raw'
import type { Policy } from '../simulation/policy'

export const POLICY_FILES = { catalogRead, uploadsWrite, catalogApp, invoicesRead, publicRead, cors, awsAccessCredentials, presign }

export const POLICIES: Record<'catalog-read' | 'uploads-write' | 'catalog-app' | 'public-read', Policy> = {
  'catalog-read': JSON.parse(catalogRead) as Policy,
  'uploads-write': JSON.parse(uploadsWrite) as Policy,
  'catalog-app': JSON.parse(catalogApp) as Policy,
  'public-read': JSON.parse(publicRead) as Policy,
}
