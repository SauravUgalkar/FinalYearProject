import axios from 'axios';

const API = 'http://localhost:5000/api';

const authHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`,
});

const get = async (url) => {
  const res = await axios.get(url, { headers: authHeaders() });
  return res.data;
};

const post = async (url, body = {}) => {
  const res = await axios.post(url, body, { headers: authHeaders() });
  return res.data;
};

const encodeProjectId = (projectId) => encodeURIComponent(projectId);

export const gitService = {
  getStatus(projectId) {
    return get(`${API}/git/${encodeProjectId(projectId)}/simple/status`);
  },

  initRepo(projectId) {
    return post(`${API}/git/${encodeProjectId(projectId)}/simple/init`);
  },

  stageAll(projectId) {
    return post(`${API}/git/${encodeProjectId(projectId)}/simple/stage-all`);
  },

  commit(projectId, message) {
    return post(`${API}/git/${encodeProjectId(projectId)}/simple/commit`, { message });
  },

  push(projectId) {
    return post(`${API}/git/${encodeProjectId(projectId)}/simple/push`);
  },

  pull(projectId) {
    return post(`${API}/git/${encodeProjectId(projectId)}/simple/pull`);
  },

  clone(projectId, repoUrl) {
    return post(`${API}/git/${encodeProjectId(projectId)}/simple/clone`, { repoUrl });
  },

  connectRemote(projectId, repoUrl) {
    return post(`${API}/git/${encodeProjectId(projectId)}/simple/connect-remote`, { repoUrl });
  },
};
