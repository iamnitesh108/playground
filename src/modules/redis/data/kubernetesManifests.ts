// The Kubernetes lesson's manifests, imported as text from tools/redis-capture/k8s so the lesson always shows
// the files that capture-kubernetes.mjs mounted into containers and kubeconform validated.
import backup from '../../../../tools/redis-capture/k8s/backup.yaml?raw'
import configmap from '../../../../tools/redis-capture/k8s/configmap.yaml?raw'
import networkpolicy from '../../../../tools/redis-capture/k8s/networkpolicy.yaml?raw'
import secret from '../../../../tools/redis-capture/k8s/secret.yaml?raw'
import statefulset from '../../../../tools/redis-capture/k8s/statefulset.yaml?raw'

/** Splits a multi-document YAML file into its documents (on lines that are exactly `---`). */
const documents = (text: string) => text.split(/^---$/m).map((d) => d.trim())

const [headless, primary, sts, pdb] = documents(statefulset)
const [cronjob, snapshot] = documents(backup)

export const MANIFESTS = { secret: secret.trim(), configmap: configmap.trim(), headless, primary, statefulset: sts, pdb, networkpolicy: networkpolicy.trim(), cronjob, snapshot }
