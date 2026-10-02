"""Remove StyleSheet entries no longer referenced as styles.<name>.  python3 scripts/prune-styles.py <file>..."""
import re, sys
for p in sys.argv[1:]:
    s = open(p).read()
    i = s.index('const styles = StyleSheet.create({')
    head, block = s[:i], s[i:]
    removed = []
    for name in re.findall(r'\n  ([a-zA-Z0-9_]+): \{', block):
        if re.search(r'styles\.' + name + r'\b', head):
            continue
        m = re.search(r'\n  ' + name + r': \{[^\n]*\},', block) or re.search(r'\n  ' + name + r': \{\n(    .*\n|\n)*?  \},', block)
        if m:
            block = block[:m.start()] + block[m.end():]
            removed.append(name)
    open(p, 'w').write(head + block)
    print(p, 'removed', len(removed), ' '.join(removed))
