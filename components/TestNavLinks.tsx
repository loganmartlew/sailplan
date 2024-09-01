import { Link } from 'expo-router';
import { View } from 'react-native';

export function TestNavLinks() {
  return (
    <View
      style={{
        margin: 20,
        borderWidth: 1,
        borderColor: 'black',
        borderStyle: 'solid',
      }}
    >
      <Link href='/'>Calculate</Link>
      <Link href='/sails'>Sails</Link>
      <Link href='/marks'>Marks</Link>
    </View>
  );
}
