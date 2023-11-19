"use babel";
import { CompositeDisposable } from "event-kit";
import { actions } from "inkdrop";
import { graphql } from "@octokit/graphql";

const NAMESPACE = "pull-github-project";
const ENVS = {
  token: "",
  project_id: "",
  organization_name: "",
  assignee: "",
  status: "",
  labels: "",
};

const getENV = () => {
  Object.keys(ENVS).forEach((name) => {
    ENVS[name] = inkdrop.config.get(`${NAMESPACE}.${name}`);
    if (ENVS[name] === undefined) {
      inkdrop.notifications.addError(
        `${name} is not set. please set ${name}: Preferences > Plugins > pull-github-project`,
        {
          dismissable: true,
        }
      );
      throw new Error(`${name} is not set`);
    }
  });
};

// use graphql to get all project items
const getProjectItems = async () => {
  let issues = [];
  let hasNextPage = true;
  let endCursor = "";
  while (hasNextPage) {
    const { organization } = await graphql({
      query: `query ($login: String!, $projectID: Int! $endCursor: String!) {
      organization(login: $login) {
        projectV2(number: $projectID) {
          items(first: 100 after: $endCursor) {
            pageInfo {
              endCursor
              hasNextPage
            }
            nodes {
              fieldValueByName(name: "Status"){
                ... on ProjectV2ItemFieldSingleSelectValue{
                  name
                }
              }
              content{
                ... on Issue {
                  state
                  title
                  url
                  labels(first: 20){
                    nodes{
                      name
                    }
                  }
                  assignees(first: 20){
                    nodes {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`,
      login: ENVS["organization_name"],
      projectID: parseInt(ENVS["project_id"]),
      endCursor: endCursor,
      headers: {
        authorization: `token ${ENVS["token"]}`,
      },
    });
    hasNextPage = organization.projectV2.items.pageInfo.hasNextPage;
    endCursor = organization.projectV2.items.pageInfo.endCursor;
    issues = issues.concat(organization.projectV2.items.nodes);
  }
  issues = issues.filter((issue) => {
    if (issue.fieldValueByName === null) {
      return false;
    }
    if (Object.values(issue.content).length === 0) {
      return false;
    }
    return true;
  });
  return issues.map((issue) => {
    return {
      status: issue.fieldValueByName.name,
      state: issue.content.state,
      title: issue.content.title,
      url: issue.content.url,
      labels: issue.content.labels.nodes.map((label) => label.name),
      assignees: issue.content.assignees.nodes.map(
        (assignee) => assignee.login
      ),
    };
  });
};
const getTargetIssues = (issues) => {
  return issues.filter((issue) => {
    if (Object.values(issue).length === 0) {
      return false;
    }
    if (issue.state == "CLOSED") {
      return false;
    }
    if (!issue.assignees.includes(ENVS["assignee"])) {
      return false;
    }
    const targetLabels = ENVS["labels"].split(",");
    if (
      !targetLabels.some((targetLabel) => issue.labels.includes(targetLabel))
    ) {
      return false;
    }
    if (issue.status !== ENVS["status"]) {
      return false;
    }
    return true;
  });
};

const converMarkdown = (status, issues) => {
  let markdown = `## ${status}\n`;
  issues.forEach((issue) => {
    markdown += `- [ ] [${issue.title}](${issue.url})\n`;
  });
  return markdown;
};

const pull = async () => {
  getENV();
  const issues = await getProjectItems();
  const targetIssues = await getTargetIssues(issues);
  const { editingNote } = inkdrop.store.getState();
  if (!editingNote) {
    throw new Error("editingNote is not found");
  }
  const { body } = editingNote;
  const markdown = converMarkdown(ENVS["status"], targetIssues);
  inkdrop.store.dispatch(
    actions.editingNote.update({ body: body + "\n\n" + markdown })
  );
  inkdrop.store.dispatch(actions.editor.change(true));
};

module.exports = {
  config: {
    token: {
      title: "Github Personal Access Token",
      description:
        "Create Github Personal Access Token https://github.com/settings/tokens, it needs project scope",
      type: "string",
    },
    project_id: {
      title: "Github Project ID",
      description:
        "Github Project ID, it can find in URL https://github.com/orgs/<organization name>/projects/<ID>",
      type: "string",
    },
    organization_name: {
      title: "Organization Name",
      description: "Organization Name",
      type: "string",
    },
    assignee: {
      title: "Issue creator name",
      description: "Issue creator name, it's GitHub user name",
      type: "string",
    },
    status: {
      title: "Issue status",
      description: "Issue status",
      type: "string",
    },
    labels: {
      title: "Issue labels",
      description: "Issue label",
      type: "string",
    },
  },
  activate() {
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(
      inkdrop.commands.add(document.body, {
        "pull-github-project:pull": () => pull(),
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },
};
