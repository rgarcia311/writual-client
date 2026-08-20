import { gql } from "graphql-request";

/**
 * Notes page payload. Characters, scenes and inspiration items ride along so the note
 * form's association picker can offer real targets — and so the floating reference panes
 * (the same ones the screenplay uses) can be hydrated — without a second round trip.
 */
export const PROJECT_NOTES_QUERY = gql`
query GetProjectNotes($input: ProjectFilters!) {
  getProjectData(input: $input) {
    _id
    progressTrackingEnabled
    writingTracker {
      enabled
    }
    notes {
      _id
      projectId
      title
      category
      content
      incorporated
      shouldIncorporate
      association {
        kind
        targetId
        label
      }
      createdAt
      updatedAt
    }
    characters {
      _id
      name
      imageUrl
      activeVersion
      lockedVersion
      details {
        version
        name
        gender
        age
        bio
        need
        want
      }
    }
    scenes {
      _id
      activeVersion
      lockedVersion
      versions {
        version
        sceneHeading
        act
        step
        thesis
        antithesis
        synthesis
      }
    }
    inspiration {
      _id
      title
      image
      video
      note
      links
    }
  }
}
`;
