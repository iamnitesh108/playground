// Files lesson "Patterns and operations" was recorded with (tools/s3-capture), as text.
import presign from '../../../../tools/s3-capture/ts-app/presign.ts?raw'
import uploadForm from '../../../../tools/s3-capture/ts-app/upload-form.ts?raw'
import share from '../../../../tools/s3-capture/ts-app/share.ts?raw'
import receiver from '../../../../tools/s3-capture/webhook/receiver.mjs?raw'
import rcloneConf from '../../../../tools/s3-capture/rclone/rclone.conf?raw'
import notification from '../../../../tools/s3-capture/policies/notification.json?raw'

export const PATTERN_FILES = { presign, uploadForm, share, receiver, rcloneConf, notification }

