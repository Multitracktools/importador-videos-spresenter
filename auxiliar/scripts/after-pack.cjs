const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async context => {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  // Assinatura ad-hoc gratuita. Não substitui a notarização da Apple, mas
  // evita que os componentes internos fiquem com assinaturas inválidas.
  execFileSync('/usr/bin/codesign', [
    '--force', '--deep', '--sign', '-', '--timestamp=none', appPath
  ], { stdio: 'inherit' });
};
