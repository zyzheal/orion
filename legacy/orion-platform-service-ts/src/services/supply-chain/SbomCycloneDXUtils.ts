/**
 * SbomCycloneDXUtils - CycloneDX SBOM document builder utilities
 *
 * Pure functions for constructing CycloneDX v1.4 compliant SBOM documents.
 */

import type { CycloneDXComponent, CycloneDXSBOM } from './SbomService';

// ==================== CycloneDX Builder ====================

export function buildCycloneDXComponent(comp: any): CycloneDXComponent {
  const name = comp.name || 'unknown';
  const version = comp.version || '0.0.0';
  const purl = buildPURL(name, version);

  const component: CycloneDXComponent = {
    type: 'library',
    name,
    version,
    purl,
    'bom-ref': purl,
  };

  if (comp.type && ['library', 'application', 'framework', 'container'].includes(comp.type)) {
    component.type = comp.type as CycloneDXComponent['type'];
  }

  if (comp.license) {
    component.licenses = [{ license: { id: comp.license } }];
  }

  if (comp.description) {
    component.description = comp.description;
  }

  return component;
}

export function buildDependencyRelationships(
  components: any[],
  dependencies: any[],
): { ref: string; dependsOn: string[] }[] {
  const depMap = new Map<string, Set<string>>();

  for (const comp of components) {
    const ref = buildPURL(comp.name || 'unknown', comp.version || '0.0.0');
    if (!depMap.has(ref)) {
      depMap.set(ref, new Set());
    }
  }

  for (const dep of dependencies) {
    const parentRef = buildPURL(
      dep.parent?.name || 'unknown',
      dep.parent?.version || '0.0.0',
    );
    const childRef = buildPURL(dep.name || 'unknown', dep.version || '0.0.0');

    if (!depMap.has(parentRef)) {
      depMap.set(parentRef, new Set());
    }
    depMap.get(parentRef)!.add(childRef);
  }

  return Array.from(depMap.entries()).map(([ref, deps]) => ({
    ref,
    dependsOn: Array.from(deps),
  }));
}

export function buildCycloneDXSBOM(
  components: CycloneDXComponent[],
  dependencies: { ref: string; dependsOn: string[] }[],
  vulnerabilities: any[],
): CycloneDXSBOM {
  const sbom: CycloneDXSBOM = {
    $schema: 'http://cyclonedx.org/schema/bom-1.4.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    serialNumber: `urn:uuid:${generateUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          name: '@orion/platform-service',
          vendor: 'Orion',
          version: '1.0.0',
        },
      ],
    },
    components,
    dependencies,
  };

  if (vulnerabilities.length > 0) {
    sbom.vulnerabilities = vulnerabilities;
  }

  return sbom;
}

// ==================== Helpers ====================

export function buildPURL(name: string, version: string): string {
  const encodedName = encodeURIComponent(name).replace(/%2F/g, '/');
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

export function generateUUID(): string {
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8];
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}
