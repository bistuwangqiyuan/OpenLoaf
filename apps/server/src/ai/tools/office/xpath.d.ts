declare module 'xpath' {
  function useNamespaces(
    namespaces: Record<string, string>,
  ): (expression: string, node: Node) => Node[]
  function select(expression: string, node: Node): Node[]
  function select1(expression: string, node: Node): Node | undefined
  export { useNamespaces, select, select1 }
  export default { useNamespaces, select, select1 }
}
