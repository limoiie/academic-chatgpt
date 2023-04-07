import camelcase from 'camelcase';
import { CollectionIndexProfile } from '~/utils/bindings';

export function namespaceOfProfile(profile: CollectionIndexProfile) {
  return [
    camelcase(profile.name),
    profile.collectionId.toString(),
    profile.splittingId.toString(),
    profile.embeddingsConfigId.toString(),
    profile.vectordbConfigId.toString(),
  ].join('-');
}
