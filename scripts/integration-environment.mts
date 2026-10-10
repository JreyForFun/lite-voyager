export function integrationEnvironment(parent: NodeJS.ProcessEnv, profile: string): NodeJS.ProcessEnv {
  return {
    ...parent,
    // The selected test host must initialize its own bootstrap/cache paths.
    // Explicit undefined omits these keys when Node launches the child.
    VSCODE_NODE_COMPILE_CACHE_ROOT: undefined,
    VSCODE_CODE_CACHE_PATH: undefined,
    VSCODE_CWD: undefined,
    LITE_VOYAGER_TEST_PROFILE: profile,
  };
}
