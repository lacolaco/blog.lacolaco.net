import * as functions from "firebase-functions";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: "01a60681fd7b3dd42d1252ab838285ef39dc58bb"
});

export const syncRemotePosts = functions.https.onRequest(
  (request, response) => {
    if (request.method.toLowerCase() !== "post") {
      response.status(200).send("POST only Supported");
      return;
    }
    octokit.repos
      .createDispatchEvent({
        owner: "lacolaco",
        repo: "blog.lacolaco.net",
        event_type: "sync-remote-posts"
      })
      .then(() => {
        response.status(200).send("OK");
      })
      .catch(error => {
        response.status(500).send(error);
      });
  }
);
