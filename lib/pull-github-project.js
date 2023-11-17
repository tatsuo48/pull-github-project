'use babel';

import PullGithubProjectMessageDialog from './pull-github-project-message-dialog';

module.exports = {

  activate() {
    inkdrop.components.registerClass(PullGithubProjectMessageDialog);
    inkdrop.layouts.addComponentToLayout(
      'modal',
      'PullGithubProjectMessageDialog'
    )
  },

  deactivate() {
    inkdrop.layouts.removeComponentFromLayout(
      'modal',
      'PullGithubProjectMessageDialog'
    )
    inkdrop.components.deleteClass(PullGithubProjectMessageDialog);
  }

};
