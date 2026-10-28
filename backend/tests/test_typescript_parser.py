"""
Unit tests for TypeScript AST parser.
"""

from app.analyzer.typescript_parser import TypeScriptParser


def test_typescript_ast_property_access():
    parser = TypeScriptParser()
    content = """
import React from 'react';
export const Profile = ({ response }: any) => {
    const userId = response.user_id;
    return <div>{userId}</div>;
};
"""
    result = parser.parse_files({"src/Profile.tsx": content})
    assert len(result.warnings) == 0
    props = [p.property for p in result.property_accesses]
    assert "user_id" in props
    matched = [p for p in result.property_accesses if p.property == "user_id"][0]
    assert matched.line == 4
    assert matched.expression == "response"


def test_typescript_interface_and_route():
    parser = TypeScriptParser()
    content = """
interface UserResponse {
    user_id: number;
    username: string;
}
export async function fetchUser() {
    return fetch("/api/users/101");
}
"""
    result = parser.parse_files({"src/api.ts": content})
    assert len(result.type_fields) == 2
    types = {tf.field_name: tf.field_type for tf in result.type_fields}
    assert "user_id" in types
    assert types["user_id"] == "number"

    assert len(result.api_endpoints) == 1
    assert result.api_endpoints[0].endpoint == "/api/users/101"
