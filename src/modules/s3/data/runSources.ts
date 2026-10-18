// Files the lessons show exactly as they were used by the recordings (tools/s3-capture), imported as text.
import awsConfig from '../../../../tools/s3-capture/aws/config?raw'
import awsCredentials from '../../../../tools/s3-capture/aws/credentials?raw'
import compose from '../../../../tools/s3-capture/compose/compose.yaml?raw'

export const RUN_SOURCES = { awsConfig, awsCredentials, compose }
