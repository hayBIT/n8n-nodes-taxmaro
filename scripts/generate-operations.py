#!/usr/bin/env python3
"""Generates nodes/Taxmaro/operations.generated.ts from the Taxmaro OpenAPI spec.

Usage: python3 scripts/generate-operations.py /path/to/openapi.json
"""
import json
import re
import sys
from pathlib import Path

PREFIX = '/api/v1'
MAX_EXAMPLE_BYTES = 3000

SCOPES = {
	'colleagues': 'Colleague',
	'companies': 'Company',
	'valid_contracts': 'Valid Contract',
	'follow_up_contracts': 'Follow-Up Contract',
	'payrolls': 'Payroll',
	'countries': 'Country',
}

# The spec documents this operation under a broken path ("/unauthenticated").
PATH_FIXES = {'/unauthenticated': '/companies/{company_id}/salary_types'}

RESOURCE_NAMES = {
	'AllwanceTravels': 'Allowance Travel',
	'Bonuses': 'Bonus',
	'SsnValidation': 'SSN Validation',
	'DeleteNotificationsBulks': 'Notification Bulk Delete',
	'TimeTrackingBulkDelete': 'Time Tracking Bulk Delete',
	'Absence Type': 'Absence Type',
	'Contract Form': 'Contract Form',
	'Contract types': 'Contract Type',
	'Employee Type': 'Employee Type',
	'Federal States': 'Federal State',
	'Payroll Groups': 'Payroll Group',
	'Salary Types': 'Salary Type',
	'WorkTime': 'Work Time',
}


ACTION_LABELS = {
	'actions': 'Perform Action',
	'validation': 'Validate',
	'bulks': 'Bulk Delete',
	'approvals': 'Approve',
	'decisions': 'Decide',
}


def camel(text):
	parts = [p for p in re.split(r'[^A-Za-z0-9]+', re.sub(r'([a-z])([A-Z])', r'\1 \2', text)) if p]
	return parts[0].lower() + ''.join(p.capitalize() for p in parts[1:])


def singular(word):
	if word.endswith('ies'):
		return word[:-3] + 'y'
	if word.endswith('sses'):
		return word[:-2]
	if word.endswith('uses'):
		return word[:-2]
	if word.endswith('s') and not word.endswith('ss'):
		return word[:-1]
	return word


def resource_name(tag):
	if tag in RESOURCE_NAMES:
		return RESOURCE_NAMES[tag]
	words = re.sub(r'([a-z])([A-Z])', r'\1 \2', tag).split(' ')
	words[-1] = singular(words[-1])
	return ' '.join(words)


def first_example(content):
	for media in content.values():
		for example in (media.get('examples') or {}).values():
			value = example.get('value')
			if value is not None:
				return value
	return None


def classify(method, path):
	segs = [s for s in path.strip('/').split('/') if s]
	last = segs[-1]
	by_id = last.startswith('{')
	ext = None
	if '.' in last:
		last, ext = last.rsplit('.', 1)
	if method == 'get':
		if ext:
			return 'export', 'Export', ext
		if last == 'new':
			return 'getNew', 'Get New (Template)', None
		if last.endswith('_configuration'):
			return 'get', 'Get', None
		return ('get', 'Get', None) if by_id else ('getMany', 'Get Many', None)
	if method == 'post':
		if ext:
			return 'export', 'Export', ext
		if segs[-1] in ('new_absence_requests', 'allowance_request_item') or by_id:
			return 'create', 'Create', None
		plural_resource = segs[-1]
		# POST on a collection creates a record; POST on an "action" endpoint triggers an action.
		if plural_resource.startswith('bulk_'):
			return camel(plural_resource), 'Bulk Delete', None
		if plural_resource.endswith(('_actions', '_validation', '_bulks', '_decisions', '_approvals')):
			return camel(plural_resource), ACTION_LABELS.get(plural_resource.rsplit('_', 1)[-1], 'Perform Action'), None
		return 'create', 'Create', None
	if method == 'put':
		return 'update', 'Update', None
	if method == 'patch':
		return 'update', 'Update', None
	if method == 'delete':
		return 'delete', 'Delete', None
	return method, method.title(), None


def main():
	spec = json.loads(Path(sys.argv[1]).read_text())
	ops = []
	for raw_path, item in spec['paths'].items():
		fixed = PATH_FIXES.get(raw_path, raw_path)
		path = fixed[len(PREFIX):] if fixed.startswith(PREFIX) else fixed
		for method, op in item.items():
			if method not in ('get', 'post', 'put', 'patch', 'delete'):
				continue
			tag = (op.get('tags') or ['Misc'])[0]
			if tag == 'Sessions':
				continue  # login/logout is handled by the credential
			kind, label, ext = classify(method, path)
			segs = [s for s in path.strip('/').split('/') if s]
			scope = SCOPES.get(segs[0], '')
			path_params = re.findall(r'\{(\w+)\}', path)
			queries = [p for p in op.get('parameters', []) if p['in'] == 'query']
			response_types = {
				c for r in op.get('responses', {}).values() for c in r.get('content', {})
			}
			binary = None
			if method == 'get' and ext:
				binary = ext
			elif ext and any(t.startswith('text/csv') for t in response_types):
				binary = ext
			body = None
			if 'requestBody' in op and method != 'delete':
				example = first_example(op['requestBody'].get('content', {}))
				body = example if example is not None and len(json.dumps(example)) <= MAX_EXAMPLE_BYTES else {}
			ops.append({
				'resource': camel(resource_name(tag)),
				'resourceName': resource_name(tag),
				'kind': kind,
				'label': label,
				'scope': scope,
				'method': method.upper(),
				'path': path,
				'pathParams': path_params,
				'queryParams': [q['name'] for q in queries],
				'summary': op.get('summary') or '',
				'body': body,
				'binary': binary,
			})

	# Build unique operation names/values per resource.
	by_resource = {}
	for op in ops:
		by_resource.setdefault(op['resource'], []).append(op)
	for resource, group in by_resource.items():
		scopes = {o['scope'] for o in group}
		for op in group:
			name = op['label']
			if len(scopes) > 1 and op['scope']:
				name += f" ({op['scope']})"
			op['name'] = name
			base = f"{resource}_{op['kind']}{op['scope'].replace(' ', '').replace('-', '')}"
			op['value'] = base
		seen = {}
		for op in group:
			n = seen.get(op['value'], 0)
			seen[op['value']] = n + 1
			if n:
				op['value'] += str(n + 1)
				op['name'] += f' {n + 1}'

	ops.sort(key=lambda o: (o['resourceName'], o['name']))
	out = Path(__file__).resolve().parent.parent / 'nodes' / 'Taxmaro' / 'operations.generated.ts'
	header = (
		'// Generated by scripts/generate-operations.py from the Taxmaro OpenAPI spec. Do not edit.\n'
		"import type { TaxmaroOperation } from './types';\n\n"
	)
	out.write_text(
		header + 'export const operations: TaxmaroOperation[] = ' + json.dumps(ops, indent='\t') + ';\n'
	)
	print(f'{len(ops)} operations, {len(by_resource)} resources -> {out}')


main()
